/**
 * Rooms Handler - Room browsing and joining
 * 
 * ============================================================
 * CHAT POOL SYSTEM
 * ============================================================
 * 
 * Chat Pool Setup Guide:
 * 1. Create 5-10 private Telegram supergroups manually via Telegram app
 * 2. Add your bot to each group
 * 3. Promote bot to admin with permissions: Delete messages, Invite users, Change info, Pin messages
 * 4. Get each group's chat ID (send a message, forward to @userinfobot, or use getUpdates)
 * 5. Register each group: /admin → Chat Management → Add Chat → Enter chat ID
 * 6. Verify: Chat List should show all groups as "FREE"
 * 7. When a room launches, a free chat will be auto-assigned
 * 
 * Chat Assignment:
 * - Chats are assigned when room status changes to OPEN (launch)
 * - Don't "hold" a chat while room is QUEUING
 * - Each room gets one chat from the pool
 * 
 * Participant Access:
 * - Only users with ACTIVE bets can access the chat
 * - Chat invite link is sent via DM when user taps "View Room Chat"
 * - After settlement, chat is nuked and recycled back to pool
 * 
 * Chat Lifecycle:
 * - Assignment: Room launches → chat assigned, renamed, invite link created
 * - Lock: When betting closes → chat permissions updated (users can now chat)
 * - Settlement: Room settles → invite links revoked, chat renamed to "NUKED", set read-only
 * - Recycling: Chat marked as FREE in pool, ready for next room
 * 
 * Telegram Group Constraints:
 * - Bot must be admin in all groups
 * - Groups must be supergroups (not regular groups)
 * - Bot needs permissions: Delete messages, Invite users, Change info, Pin messages
 * - Invite links expire at room settleTime
 * - Member limit set to room capacity
 */

import { Context } from 'telegraf';
import { listRooms, getRoomDetails, joinRoom } from '../domain/room';
import { formatRoomsListMessage, formatRoomDetailsMessage, formatJoinRoomMessage } from '../messages/rooms';
import { getRoomsListKeyboard, getRoomDetailsKeyboard, getJoinRoomKeyboard } from '../keyboards/rooms';
import { prisma } from '../infra/db';

export async function handleEnterRooms(ctx: Context, page: number = 0) {
  try {
    const { rooms, totalPages } = await listRooms(page, 5);

    const message = formatRoomsListMessage(
      rooms.map(r => ({
        id: r.id,
        title: r.title,
        status: r.status,
        currentPlayers: r.currentPlayers,
        cap: r.cap,
        timeLeft: r.timeLeft,
        pool: r.pool,
        roomNumber: r.roomNumber,
      })),
      page,
      totalPages
    );
    const keyboard = getRoomsListKeyboard(
      rooms.map(r => ({
        id: r.id,
        title: r.title,
        status: r.status as 'QUEUING' | 'OPEN' | 'LOCKED' | 'SETTLED',
        currentPlayers: r.currentPlayers,
        cap: r.cap,
        timeLeft: r.timeLeft,
        roomNumber: r.roomNumber,
      })),
      page,
      totalPages
    );

    const sentMessage = await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    
    // Register for auto-refresh if there are queuing or open rooms
    if (rooms.some(r => r.status === 'QUEUING' || r.status === 'OPEN')) {
      const { registerTimer } = await import('../utils/timerManager');
      const messageId = typeof sentMessage === 'object' && 'message_id' in sentMessage 
        ? sentMessage.message_id 
        : ctx.callbackQuery?.message?.message_id;
      
      if (messageId && ctx.chat?.id) {
        registerTimer(ctx.chat.id, messageId, 'rooms_list', { page });
      }
    }
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleEnterRooms:', error);
    await ctx.answerCbQuery('❌ Error loading rooms');
  }
}

export async function handleRoomDetails(ctx: Context, roomId: string) {
  try {
    const room = await getRoomDetails(roomId);
    const canJoin = (room.status === 'QUEUING' || room.status === 'OPEN') && room.currentPlayers < room.cap;

    const message = formatRoomDetailsMessage(room);
    const keyboard = getRoomDetailsKeyboard(roomId, canJoin, room.status);

    const sentMessage = await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    
    // Register for auto-refresh if room is queuing or open
    if (room.status === 'QUEUING' || room.status === 'OPEN') {
      const { registerTimer } = await import('../utils/timerManager');
      const messageId = typeof sentMessage === 'object' && 'message_id' in sentMessage 
        ? sentMessage.message_id 
        : ctx.callbackQuery?.message?.message_id;
      
      if (messageId && ctx.chat?.id) {
        registerTimer(ctx.chat.id, messageId, 'room_details', { roomId });
      }
    }
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleRoomDetails:', error);
    await ctx.answerCbQuery('❌ Error loading room details');
  }
}

export async function handleJoinQueue(ctx: Context, roomId: string) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const room = await getRoomDetails(roomId);
    
    // Check if room is in QUEUING status
    if (room.status !== 'QUEUING') {
      await ctx.answerCbQuery('❌ This arena has already launched!');
      return;
    }

    // Check if already in queue
    const existingBet = await prisma.bet.findFirst({
      where: {
        roomId,
        userId: (await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } }))?.id,
        status: 'QUEUED',
      },
    });

    if (existingBet) {
      await ctx.answerCbQuery('✅ You are already in the queue!');
      return;
    }

    // Set conversation state to ask for bet amount
    const { setUserState } = await import('../utils/conversationState');
    setUserState(telegramId, 'bet_amount', { roomId, side: 'QUEUE' });

    await ctx.answerCbQuery('💰 Send bet amount');
    await ctx.reply(
      `⏳ *Join Battle Queue*\n\n` +
      `${room.title}\n\n` +
      `💰 How much SOL would you like to bet?\n\n` +
      `Min Bet: ${room.minBet} SOL\n` +
      (room.maxBet ? `Max Bet: ${room.maxBet} SOL\n` : '') +
      `\n_You'll choose YES/NO when the arena launches_\n\n` +
      `Enter amount:`,
      {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true },
      }
    );
  } catch (error) {
    console.error('Error in handleJoinQueue:', error);
    await ctx.answerCbQuery('❌ Error joining queue');
  }
}

export async function handleJoinRoom(ctx: Context, roomId: string, side: 'YES' | 'NO') {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const room = await getRoomDetails(roomId);
    
    // Set conversation state to ask for bet amount
    const { setUserState } = await import('../utils/conversationState');
    setUserState(telegramId, 'bet_amount', { roomId, side });

    await ctx.answerCbQuery('💰 Send bet amount');
    await ctx.reply(
      `💰 *How much SOL would you like to bet?*\n\n` +
      `Betting *${side}* on:\n${room.title}\n\n` +
      `Min Bet: ${room.minBet} SOL\n` +
      (room.maxBet ? `Max Bet: ${room.maxBet} SOL\n` : '') +
      `\nEnter amount:`,
      {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true },
      }
    );
  } catch (error) {
    console.error('Error in handleJoinRoom:', error);
    await ctx.answerCbQuery('❌ Error joining room');
  }
}

export async function handleBetAmountInput(ctx: Context, text: string, roomId: string, side: string) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const amount = parseFloat(text);
    
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Invalid amount. Please enter a valid number.');
      return;
    }

    const room = await getRoomDetails(roomId);

    // Validate against min/max
    if (amount < room.minBet) {
      await ctx.reply(`❌ Amount too low. Minimum bet is ${room.minBet} SOL.`);
      return;
    }

    if (room.maxBet && amount > room.maxBet) {
      await ctx.reply(`❌ Amount too high. Maximum bet is ${room.maxBet} SOL.`);
      return;
    }

    // Delete user's message
    try {
      await ctx.deleteMessage();
    } catch (e) {
      // Ignore
    }

    // Clear conversation state
    const { clearUserState } = await import('../utils/conversationState');
    clearUserState(telegramId);

    if (side === 'QUEUE') {
      // Join queue directly
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) }
      });

      if (!user) {
        await ctx.reply('❌ User not found');
        return;
      }

      // Create bet with QUEUED status and side as YES (default, can be changed on launch)
      await prisma.bet.create({
        data: {
          userId: user.id,
          roomId,
          side: 'YES', // Default, will be chosen on launch
          amount: new (await import('@prisma/client/runtime/library')).Decimal(amount),
          status: 'QUEUED',
        },
      });

      // Update room player count
      await prisma.room.update({
        where: { id: roomId },
        data: {
          currentPlayers: { increment: 1 },
        },
      });

      await ctx.reply(
        `✅ *Joined Queue!*\n\n` +
        `${room.title}\n\n` +
        `💰 Bet Amount: ${amount.toFixed(4)} SOL\n\n` +
        `⏳ Waiting for admin to launch the arena...\n` +
        `You'll be sent the group invite link once it starts!`,
        { parse_mode: 'Markdown' }
      );
    } else {
      // Normal betting flow (for when arena is launched)
      const message = formatJoinRoomMessage(room.title, side, amount);
      const keyboard = getJoinRoomKeyboard(roomId, side as 'YES' | 'NO', amount);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error('Error in handleBetAmountInput:', error);
    await ctx.reply('❌ Error processing bet amount');
  }
}

export async function handleConfirmBet(ctx: Context, roomId: string, side: 'YES' | 'NO', amount: number) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Place bet
    await joinRoom(telegramId, roomId, side, amount);

    await ctx.answerCbQuery('✅ Bet placed successfully!');

    // Show updated room details
    await handleRoomDetails(ctx, roomId);
  } catch (error: any) {
    console.error('Error in handleConfirmBet:', error);
    await ctx.answerCbQuery(`❌ ${error.message || 'Error placing bet'}`);
  }
}

export async function handleRecentRooms(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!user) {
      await ctx.answerCbQuery('❌ User not found');
      return;
    }

    // Get recent rooms user participated in (SETTLED only)
    const recentBets = await prisma.bet.findMany({
      where: { 
        userId: user.id,
      },
      include: { 
        room: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20, // Get more to filter
    });

    // Filter to only rooms that are SETTLED
    const settledBets = recentBets.filter(bet => bet.room.status === 'SETTLED').slice(0, 10);

    let message = '🕓 *Recent Rooms*\n\n';

    if (settledBets.length === 0) {
      message += 'No recent rooms.\n\n_Join a room to see it here!_';
    } else {
      // Get room numbers for display
      const allSettledRooms = await prisma.room.findMany({
        where: { status: 'SETTLED' },
        orderBy: { createdAt: 'asc' },
      });

      settledBets.forEach((bet, index) => {
        const roomIndex = allSettledRooms.findIndex(r => r.id === bet.room.id);
        const roomNumber = roomIndex >= 0 ? allSettledRooms.length - roomIndex : index + 1;
        
        const emoji = '💀'; // Nuked/Settled rooms
        const winner = bet.room.winningSide || 'UNKNOWN';
        
        message += `${index + 1}. ${emoji} ROOM #${roomNumber} - ${bet.room.title}\n`;
        message += `   Winner: ${winner}\n\n`;
      });
    }

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Back to Dashboard', callback_data: 'cb:back_dashboard' }]],
      },
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleRecentRooms:', error);
    await ctx.answerCbQuery('❌ Error loading recent rooms');
  }
}

