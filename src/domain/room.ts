/**
 * Room Domain - Business logic for prediction market rooms
 */

import { prisma } from '../infra/db';
import { Decimal } from '@prisma/client/runtime/library';
import { Telegraf } from 'telegraf';
import { formatSettlementNotification } from '../messages/settlement';

/**
 * List available rooms with pagination
 */
export async function listRooms(page: number = 0, limit: number = 5) {
  const rooms = await prisma.room.findMany({
    where: {
      status: { in: ['QUEUING', 'OPEN', 'LOCKED'] },
    },
    orderBy: { createdAt: 'desc' },
    skip: page * limit,
    take: limit,
  });

  const total = await prisma.room.count({
    where: {
      status: { in: ['QUEUING', 'OPEN', 'LOCKED'] },
    },
  });

  // Get total count for accurate room numbering
  const totalRooms = await prisma.room.count({
    where: {
      status: { in: ['QUEUING', 'OPEN', 'LOCKED'] },
    },
  });

  return {
    rooms: rooms.map((room, index) => {
      // Calculate room number: total rooms - (page * limit + index)
      // This gives sequential numbering: newest room = highest number
      const roomNumber = totalRooms - (page * limit + index);
      return {
        id: room.id,
        title: room.title,
        status: room.status,
        currentPlayers: room.currentPlayers,
        cap: room.cap,
        pool: room.pool.toNumber(),
        timeLeft: calculateTimeLeft(room.lockTime),
        roomNumber,
      };
    }),
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get room details by ID
 */
export async function getRoomDetails(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      bets: {
        where: { status: 'ACTIVE' },
        include: {
          user: true,
        },
      },
    },
  });

  if (!room) {
    throw new Error('Room not found');
  }

  // Get usernames for YES and NO sides
  const yesBets = room.bets.filter(b => b.side === 'YES');
  const noBets = room.bets.filter(b => b.side === 'NO');
  
  const yesUsernames = yesBets
    .map(b => {
      if (b.user.username) {
        return b.user.username.startsWith('@') ? b.user.username : `@${b.user.username}`;
      }
      return `user${b.user.telegramId}`;
    });
  
  const noUsernames = noBets
    .map(b => {
      if (b.user.username) {
        return b.user.username.startsWith('@') ? b.user.username : `@${b.user.username}`;
      }
      return `user${b.user.telegramId}`;
    });

  // Get creator username if room has a host
  let creatorUsername: string | undefined;
  if (room.hostUser) {
    if (room.hostUser.username) {
      creatorUsername = room.hostUser.username.startsWith('@') 
        ? room.hostUser.username 
        : `@${room.hostUser.username}`;
    } else {
      creatorUsername = `user${room.hostUser.telegramId}`;
    }
  }

  return {
    id: room.id,
    title: room.title,
    description: room.description || undefined,
    status: room.status,
    oracleFeed: room.oracleFeed,
    currentPlayers: room.currentPlayers,
    cap: room.cap,
    pool: room.pool.toNumber(),
    longPool: room.longPool.toNumber(),
    shortPool: room.shortPool.toNumber(),
    minBet: room.minBet.toNumber(),
    maxBet: room.maxBet?.toNumber(),
    lockTime: room.lockTime,
    settleTime: room.settleTime,
    lockPrice: room.lockPrice?.toNumber(),
    inviteLink: room.inviteLink || undefined,
    groupChatId: room.groupChatId || undefined,
    chatId: room.chatId || undefined,
    yesUsernames,
    noUsernames,
    creatorUsername,
  };
}

/**
 * Join a room with a bet
 */
export async function joinRoom(
  telegramId: number,
  roomId: string,
  side: 'YES' | 'NO',
  amount: number
) {
  // Get user
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check balance
  const balance = user.balance.toNumber();
  if (balance < amount) {
    throw new Error('Insufficient balance');
  }

  // Get room
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw new Error('Room not found');
  }

  // Validate room is open
  if (room.status !== 'OPEN') {
    throw new Error('Room is not open for betting');
  }

  // Check room capacity
  if (room.currentPlayers >= room.cap) {
    throw new Error('Room is full');
  }

  // Check bet limits
  const minBet = room.minBet.toNumber();
  if (amount < minBet) {
    throw new Error(`Minimum bet is ${minBet} SOL`);
  }

  if (room.maxBet) {
    const maxBet = room.maxBet.toNumber();
    if (amount > maxBet) {
      throw new Error(`Maximum bet is ${maxBet} SOL`);
    }
  }

  // Check if user already has an active bet in this room
  const existingBet = await prisma.bet.findFirst({
    where: {
      userId: user.id,
      roomId: room.id,
      status: 'ACTIVE',
    },
  });

  // Only allow one bet per user per room
  if (existingBet) {
    throw new Error('You already have an active bet in this room');
  }

  // Create bet and update room in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create bet with ACTIVE status (room is OPEN)
    const bet = await tx.bet.create({
      data: {
        userId: user.id,
        roomId: room.id,
        side,
        amount: new Decimal(amount),
        status: 'ACTIVE', // Set to ACTIVE when room is OPEN
      },
    });

    // Update user balance
    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: { decrement: new Decimal(amount) },
      },
    });

    // Count unique players (users with ACTIVE bets in this room)
    const uniquePlayers = await tx.bet.groupBy({
      by: ['userId'],
      where: {
        roomId: room.id,
        status: 'ACTIVE',
      },
    });

    // Update room with accurate player count
    await tx.room.update({
      where: { id: room.id },
      data: {
        currentPlayers: uniquePlayers.length,
        pool: { increment: new Decimal(amount) },
        ...(side === 'YES'
          ? { longPool: { increment: new Decimal(amount) } }
          : { shortPool: { increment: new Decimal(amount) } }),
      },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId: user.id,
        type: 'BET',
        amount: new Decimal(amount),
        status: 'CONFIRMED',
        metadata: { roomId: room.id, betId: bet.id, side },
      },
    });

    return bet;
  });

  return result;
}

/**
 * Settle a room with a known winner (for oracle-based settlement)
 */
export async function settleRoomWithWinner(roomId: string, winningSide: 'YES' | 'NO') {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      bets: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!room) {
    throw new Error('Room not found');
  }

  if (room.status !== 'LOCKED') {
    throw new Error('Room must be locked before settlement');
  }

  // Calculate fees
  const totalPool = room.pool.toNumber();
  const protocolFeeAmount = totalPool * 0.02; // 2%
  const hostFeeAmount = totalPool * 0.01; // 1%
  const payoutPool = totalPool - protocolFeeAmount - hostFeeAmount;

  const winningPool = winningSide === 'YES' ? room.longPool.toNumber() : room.shortPool.toNumber();

  // Settle bets
  for (const bet of room.bets) {
    const won = bet.side === winningSide;
    let payout = 0;

    if (won && winningPool > 0) {
      const betAmount = bet.amount.toNumber();
      payout = (betAmount / winningPool) * payoutPool;
    }

    await prisma.bet.update({
      where: { id: bet.id },
      data: {
        settled: true,
        won,
        payout: new Decimal(payout),
      },
    });

    if (won && payout > 0) {
      // Credit user
      await prisma.user.update({
        where: { id: bet.userId },
        data: {
          balance: { increment: new Decimal(payout) },
        },
      });

      // Record transaction
      await prisma.transaction.create({
        data: {
          userId: bet.userId,
          type: 'WIN',
          amount: new Decimal(payout),
          status: 'CONFIRMED',
          metadata: { roomId: room.id, betId: bet.id },
        },
      });
    }
  }

  // Update room
  await prisma.room.update({
    where: { id: roomId },
    data: {
      status: 'SETTLED',
      winningSide,
      settledAt: new Date(),
    },
  });
}

/**
 * Settle a room
 * STUB: In production, this would fetch oracle price and calculate winners
 */
export async function settleRoom(roomId: string, finalPrice: number) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      bets: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!room) {
    throw new Error('Room not found');
  }

  if (room.status !== 'LOCKED') {
    throw new Error('Room must be locked before settlement');
  }

  if (!room.lockPrice) {
    throw new Error('Lock price not set');
  }

  const lockPrice = room.lockPrice.toNumber();
  const winningSide = finalPrice > lockPrice ? 'YES' : 'NO';

  // Calculate fees
  const totalPool = room.pool.toNumber();
  const protocolFeeAmount = totalPool * 0.02; // 2%
  const hostFeeAmount = totalPool * 0.01; // 1%
  const payoutPool = totalPool - protocolFeeAmount - hostFeeAmount;

  const winningPool = winningSide === 'YES' ? room.longPool.toNumber() : room.shortPool.toNumber();

  // Settle bets
  for (const bet of room.bets) {
    const won = bet.side === winningSide;
    let payout = 0;

    if (won && winningPool > 0) {
      const betAmount = bet.amount.toNumber();
      payout = (betAmount / winningPool) * payoutPool;
    }

    await prisma.bet.update({
      where: { id: bet.id },
      data: {
        settled: true,
        won,
        payout: new Decimal(payout),
      },
    });

    if (won && payout > 0) {
      // Credit user
      await prisma.user.update({
        where: { id: bet.userId },
        data: {
          balance: { increment: new Decimal(payout) },
        },
      });

      // Record transaction
      await prisma.transaction.create({
        data: {
          userId: bet.userId,
          type: 'WIN',
          amount: new Decimal(payout),
          status: 'CONFIRMED',
          metadata: { roomId: room.id, betId: bet.id },
        },
      });
    }
  }

  // Update room
  await prisma.room.update({
    where: { id: roomId },
    data: {
      status: 'SETTLED',
      settlePrice: new Decimal(finalPrice),
      winningSide,
      protocolFee: new Decimal(protocolFeeAmount),
      hostFee: new Decimal(hostFeeAmount),
    },
  });

  return true;
}

/**
 * Assign a chat from the pool to a room
 * Called when room is launched (status changes to OPEN)
 */
export async function assignChatForRoom(roomId: string, bot: Telegraf): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw new Error('Room not found');
  }

  // Check if room already has a chat assigned
  if (room.chatId) {
    console.log(`Room ${roomId} already has chat ${room.chatId} assigned`);
    return;
  }

  // Find a FREE chat from the pool
  const freeChat = await prisma.chatPool.findFirst({
    where: { status: 'FREE' },
  });

  if (!freeChat) {
    throw new Error('No free chats available in pool. Admin needs to add more chats.');
  }

  const chatId = freeChat.chatId;

  try {
    // Verify bot has access to the chat
    await bot.telegram.getChat(chatId);

    // Get room number for naming (count of rooms created before this one)
    const roomNumber = await prisma.room.count({
      where: { createdAt: { lte: room.createdAt } },
    });

    // Rename group
    const newTitle = `🏛️ ROOM #${roomNumber} — ${room.title}`;
    await bot.telegram.setChatTitle(chatId, newTitle);

    // Set chat permissions (muted until lock - users can't send messages yet)
    await bot.telegram.setChatPermissions(chatId, {
      can_send_messages: false,
      can_send_media_messages: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false,
      can_change_info: false,
      can_invite_users: false,
      can_pin_messages: false,
    });

    // Create invite link that expires at settleTime
    const inviteLink = await bot.telegram.createChatInviteLink(chatId, {
      expire_date: Math.floor(room.settleTime.getTime() / 1000),
      member_limit: room.cap,
    });

    // Update Room with chatId and inviteLink
    await prisma.room.update({
      where: { id: roomId },
      data: {
        chatId: chatId,
        inviteLink: inviteLink.invite_link,
      },
    });

    // Mark ChatPool entry as ASSIGNED
    await prisma.chatPool.update({
      where: { id: freeChat.id },
      data: {
        status: 'ASSIGNED',
        roomId: roomId,
      },
    });

    // Set bot commands for this chat and enable menu button
    try {
      // Set commands for this specific chat
      await bot.telegram.setMyCommands(
        [
          { command: 'watch', description: 'Live room summary' },
          { command: 'bet', description: 'Place bet: /bet <amount> <YES|NO>' },
          { command: 'players', description: 'List participants' },
          { command: 'oracle', description: 'Current oracle price' },
          { command: 'stats', description: 'Full market info' },
          { command: 'taunt', description: 'Random taunt' },
          { command: 'help', description: 'Show all commands' },
        ],
        {
          scope: {
            type: 'chat',
            chat_id: parseInt(chatId),
          },
        }
      );

      // Enable menu button for this chat
      await bot.telegram.setChatMenuButton(parseInt(chatId), {
        type: 'commands',
      });
    } catch (error) {
      console.error(`Failed to set commands for chat ${chatId}:`, error);
      // Continue even if command setting fails
    }

    // Post welcome message to group
    try {
      await bot.telegram.sendMessage(
        chatId,
        `🏛️ *ROOM #${roomNumber} — ${room.title}*\n\n` +
        `Welcome to the battle arena! This is a private chat for participants only.\n\n` +
        `*Market:* ${room.title}\n` +
        `*Oracle Feed:* ${room.oracleFeed}\n` +
        `*Capacity:* ${room.cap} players\n` +
        `*Lock Time:* ${room.lockTime.toLocaleString()}\n` +
        `*Settle Time:* ${room.settleTime.toLocaleString()}\n\n` +
        `_Chat will unlock when betting closes. Good luck!_\n\n` +
        `_Type /help to see available commands_`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error(`Failed to post welcome message to chat ${chatId}:`, error);
      // Don't fail the whole operation if message fails
    }

    console.log(`✅ Assigned chat ${chatId} to room ${roomId}`);
  } catch (error: any) {
    console.error(`Error assigning chat ${chatId} to room ${roomId}:`, error);
    throw new Error(`Failed to assign chat: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Nuke a room's chat - revoke links, rename, set read-only, optionally delete messages
 * Called when room settles
 */
export async function nukeRoomChat(roomId: string, bot: Telegraf): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room || !room.chatId) {
    // No chat assigned, nothing to nuke
    return;
  }

  const chatId = room.chatId;

  try {
    // Get room number for naming
    const roomNumber = await prisma.room.count({
      where: { createdAt: { lte: room.createdAt } },
    });

    // Revoke invite link if it exists
    if (room.inviteLink) {
      try {
        // Extract invite link ID from the full link (format: https://t.me/joinchat/... or https://t.me/+...)
        // Telegram API requires the invite link object, but we can try to revoke by getting current links
        const chat = await bot.telegram.getChat(chatId);
        if ('invite_link' in chat && chat.invite_link) {
          await bot.telegram.revokeChatInviteLink(chatId, chat.invite_link);
        }
      } catch (error) {
        console.error(`Failed to revoke invite link for chat ${chatId}:`, error);
        // Continue anyway
      }
    }

    // Rename chat
    try {
      await bot.telegram.setChatTitle(chatId, `💀 Room #${roomNumber} — NUKED`);
    } catch (error) {
      console.error(`Failed to rename chat ${chatId}:`, error);
    }

    // Set read-only permissions (no one can send messages)
    try {
      await bot.telegram.setChatPermissions(chatId, {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
      });
    } catch (error) {
      console.error(`Failed to set read-only permissions for chat ${chatId}:`, error);
    }

    // Optionally delete messages if configured
    const deleteMessages = process.env.NUKE_DELETE_MESSAGES === 'true';
    if (deleteMessages) {
      const deleteCount = parseInt(process.env.NUKE_DELETE_COUNT || '200', 10);
      try {
        // Get recent messages (Telegram API limitation: can only delete messages from last 48h)
        // We'll attempt to delete, but Telegram may limit this
        // Note: deleteMessages requires message IDs, which we'd need to track
        // For now, we'll skip this as it requires message tracking
        console.log(`Message deletion requested but not implemented (requires message tracking)`);
      } catch (error) {
        console.error(`Failed to delete messages in chat ${chatId}:`, error);
      }
    }

    // Find ChatPool entry
    const chatPoolEntry = await prisma.chatPool.findUnique({
      where: { chatId: chatId },
    });

    // Update Room: clear chatId and inviteLink
    await prisma.room.update({
      where: { id: roomId },
      data: {
        chatId: null,
        inviteLink: null,
      },
    });

    // Mark ChatPool entry as FREE, clear roomId
    if (chatPoolEntry) {
      await prisma.chatPool.update({
        where: { id: chatPoolEntry.id },
        data: {
          status: 'FREE',
          roomId: null,
        },
      });
    }

    console.log(`✅ Nuked chat ${chatId} for room ${roomId}`);
  } catch (error: any) {
    console.error(`Error nuking chat ${chatId} for room ${roomId}:`, error);
    // Still try to update database even if Telegram operations fail
    try {
      await prisma.room.update({
        where: { id: roomId },
        data: {
          chatId: null,
          inviteLink: null,
        },
      });
      const chatPoolEntry = await prisma.chatPool.findUnique({
        where: { chatId: chatId },
      });
      if (chatPoolEntry) {
        await prisma.chatPool.update({
          where: { id: chatPoolEntry.id },
          data: {
            status: 'FREE',
            roomId: null,
          },
        });
      }
    } catch (dbError) {
      console.error(`Failed to update database after nuke error:`, dbError);
    }
    throw new Error(`Failed to nuke chat: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Calculate time left until lock time
 * Returns format: "8h 58m" or "45m" or "30s"
 */
function calculateTimeLeft(lockTime: Date): string | undefined {
  const now = new Date();
  const diff = lockTime.getTime() - now.getTime();

  if (diff <= 0) {
    return undefined;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Send settlement notifications to all participants
 */
export async function sendSettlementNotifications(
  bot: Telegraf,
  roomId: string,
  winningSide: 'YES' | 'NO'
) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      bets: {
        where: { status: 'ACTIVE' },
        include: { user: true },
      },
    },
  });
  
  if (!room) return;
  
  console.log(`📤 Sending settlement notifications for room: ${room.title}`);
  
  for (const bet of room.bets) {
    const won = bet.side === winningSide;
    const message = formatSettlementNotification({
      roomTitle: room.title,
      winningSide,
      userSide: bet.side as 'YES' | 'NO',
      betAmount: bet.amount.toNumber(),
      payout: won ? bet.payout.toNumber() : 0,
      won,
    });
    
    try {
      await bot.telegram.sendMessage(bet.user.telegramId.toString(), message, {
        parse_mode: 'Markdown',
      });
      console.log(`✅ Notified user ${bet.user.telegramId} (${won ? 'WON' : 'LOST'})`);
    } catch (error) {
      console.error(`❌ Failed to notify user ${bet.user.telegramId}:`, error);
    }
  }
}

/**
 * Settle room instantly when target is reached (for instant settlement)
 */
export async function settleRoomInstantly(
  bot: Telegraf,
  roomId: string,
  winningSide: 'YES' | 'NO',
  finalPrice: number
) {
  console.log(`⚡ Instant settlement triggered for room ${roomId}`);
  
  // Check if room is already settled to avoid duplicates
  const existingRoom = await prisma.room.findUnique({
    where: { id: roomId },
  });
  
  if (!existingRoom || existingRoom.status === 'SETTLED') {
    console.log(`⚠️ Room ${roomId} is already settled, skipping duplicate settlement`);
    return;
  }
  
  // Lock room
  await prisma.room.update({
    where: { id: roomId },
    data: { 
      status: 'LOCKED', 
      lockPrice: new Decimal(finalPrice) 
    },
  });
  
  // Settle with winner
  await settleRoomWithWinner(roomId, winningSide);
  
  // Update final price
  await prisma.room.update({
    where: { id: roomId },
    data: { settlePrice: new Decimal(finalPrice) },
  });
  
  // Send notifications to all participants (only once here)
  await sendSettlementNotifications(bot, roomId, winningSide);
  
  console.log(`✅ Instant settlement complete for room ${roomId}`);
}

