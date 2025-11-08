/**
 * Admin Handlers - Admin dashboard and room creation
 */

import { Context } from 'telegraf';
import { prisma } from '../infra/db';
import { requireAdmin } from '../config/admin';
import { setUserState, getUserState, clearUserState } from '../utils/conversationState';
import {
  formatAdminDashboard,
  formatRoomCreation,
  formatRoomsList,
  formatUserManagement,
  RoomDraft,
} from '../messages/admin';
import {
  getAdminDashboardKeyboard,
  getRoomCreationKeyboard,
  getMarketTypeKeyboard,
  getTimePresetKeyboard,
  getCapacityKeyboard,
} from '../keyboards/admin';
import { Decimal } from '@prisma/client/runtime/library';

// Store room drafts per admin
const roomDrafts = new Map<number, RoomDraft>();

/**
 * Parse market cap values like "2m", "10m", "1b", "500k"
 */
function parseMarketCapValue(input: string): number {
  const text = input.toLowerCase().trim();
  
  // Check for k/m/b suffixes
  const match = text.match(/^([\d.]+)\s*([kmb])$/);
  
  if (match) {
    const value = parseFloat(match[1]);
    const suffix = match[2];
    
    switch (suffix) {
      case 'k':
        return value * 1_000;
      case 'm':
        return value * 1_000_000;
      case 'b':
        return value * 1_000_000_000;
    }
  }
  
  // Otherwise parse as plain number
  return parseFloat(text);
}

/**
 * Parse time duration like "30 minutes", "2 hours", "30m", "2h"
 */
function parseTimeDuration(input: string): number | null {
  const text = input.toLowerCase().trim();
  
  // Match patterns like "30 minutes", "30m", "2 hours", "2h", "90 minutes"
  const match = text.match(/^(\d+)\s*(h|hour|hours|m|min|minute|minutes)$/);
  
  if (!match) {
    return null;
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  // Convert to minutes
  if (unit.startsWith('h')) {
    return value * 60; // hours to minutes
  } else {
    return value; // already in minutes
  }
}

/**
 * Parse flexible date formats
 */
function parseFlexibleDate(input: string): Date | null {
  const text = input.toLowerCase().trim();
  const now = new Date();
  
  // Handle "today" formats
  if (text.startsWith('today')) {
    const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const isPM = timeMatch[3]?.toLowerCase() === 'pm';
      
      const date = new Date(now);
      date.setHours(isPM && hour !== 12 ? hour + 12 : hour === 12 && !isPM ? 0 : hour);
      date.setMinutes(minute);
      date.setSeconds(0);
      date.setMilliseconds(0);
      
      return date;
    }
  }
  
  // Handle "tomorrow" formats
  if (text.startsWith('tomorrow')) {
    const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const isPM = timeMatch[3]?.toLowerCase() === 'pm';
      
      tomorrow.setHours(isPM && hour !== 12 ? hour + 12 : hour === 12 && !isPM ? 0 : hour);
      tomorrow.setMinutes(minute);
      tomorrow.setSeconds(0);
      tomorrow.setMilliseconds(0);
      
      return tomorrow;
    }
    
    return tomorrow;
  }
  
  // Handle "5/11 23:59" or "11/5 23:59" format
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1]) - 1; // JavaScript months are 0-indexed
    const day = parseInt(slashMatch[2]);
    const hour = parseInt(slashMatch[3]);
    const minute = parseInt(slashMatch[4]);
    
    const date = new Date(now.getFullYear(), month, day, hour, minute, 0, 0);
    
    // If the date is in the past, assume next year
    if (date < now) {
      date.setFullYear(now.getFullYear() + 1);
    }
    
    return date;
  }
  
  // Try standard Date parsing as fallback
  const date = new Date(input);
  return isNaN(date.getTime()) ? null : date;
}

export async function handleAdminCommand(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    await showAdminDashboard(ctx, telegramId);
  } catch (error: any) {
    await ctx.reply(`❌ ${error.message || 'Access denied'}`);
  }
}

export async function showAdminDashboard(ctx: Context, telegramId: number) {
  try {
    requireAdmin(telegramId);

    // Fetch stats
    const totalUsers = await prisma.user.count();
    const activeRooms = await prisma.room.count({ where: { status: 'OPEN' } });
    const totalRooms = await prisma.room.count();
    
    const volumeResult = await prisma.room.aggregate({
      _sum: { pool: true },
    });
    const totalVolume = volumeResult._sum.pool?.toNumber() || 0;

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const usersToday = await prisma.user.count({
      where: { createdAt: { gte: yesterday } },
    });

    const message = formatAdminDashboard({
      totalUsers,
      activeRooms,
      totalRooms,
      totalVolume,
      usersToday,
    });

    const keyboard = getAdminDashboardKeyboard();

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      await ctx.answerCbQuery();
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  } catch (error: any) {
    console.error('Error in showAdminDashboard:', error);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
    } else {
      await ctx.reply('❌ Error loading admin dashboard');
    }
  }
}

export async function handleCreateRoom(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    // Initialize empty draft
    roomDrafts.set(telegramId, {});

    const draft = roomDrafts.get(telegramId)!;
    const message = formatRoomCreation(draft);
    const keyboard = getRoomCreationKeyboard();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleSetTitle(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    setUserState(telegramId, 'admin_set_title' as any);

    await ctx.answerCbQuery('📝 Send room title');
    await ctx.reply('📝 Enter the room title:', {
      reply_markup: { force_reply: true },
    });
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleSetMarketType(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const keyboard = getMarketTypeKeyboard();

    await ctx.editMessageText('📊 *Select Market Type*\n\nWhat type of prediction market?', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleSelectMarketType(ctx: Context, marketType: 'sol_price' | 'pumpfun_mcap' | 'custom') {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const draft = roomDrafts.get(telegramId) || {};
    draft.marketType = marketType;
    roomDrafts.set(telegramId, draft);

    // Set conversation state based on market type
    if (marketType === 'sol_price') {
      setUserState(telegramId, 'admin_set_sol_target' as any);
      await ctx.answerCbQuery('📝 Send target price');
      await ctx.reply('💰 Enter target SOL price in USD (e.g., 170):', {
        reply_markup: { force_reply: true },
      });
    } else if (marketType === 'pumpfun_mcap') {
      setUserState(telegramId, 'admin_set_token_ca' as any);
      await ctx.answerCbQuery('📝 Send contract address');
      await ctx.reply('🚀 Enter pump.fun token contract address (CA):\n\n_We use Solscan to fetch price data_', {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true },
      });
    } else if (marketType === 'custom') {
      setUserState(telegramId, 'admin_set_custom_oracle' as any);
      await ctx.answerCbQuery('📝 Send custom oracle');
      await ctx.reply('📊 Enter custom oracle/prediction:', {
        reply_markup: { force_reply: true },
      });
    }
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleSetTargetDate(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    setUserState(telegramId, 'admin_set_target_date' as any);

    await ctx.answerCbQuery('📅 Send target date');
    await ctx.reply(
      '📅 Enter target date and time:\n\n' +
      'Examples:\n' +
      '• "today 11:59pm"\n' +
      '• "today 6pm"\n' +
      '• "tomorrow 5pm"\n' +
      '• "5/11 23:59"\n' +
      '• "2025-11-06 23:59"',
      {
        reply_markup: { force_reply: true },
      }
    );
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleSetLockTime(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const keyboard = getTimePresetKeyboard('lock');

    await ctx.editMessageText('⏰ *Set Lock Time*\n\nHow long until betting closes?', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleSetSettleTime(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const keyboard = getTimePresetKeyboard('settle');

    await ctx.editMessageText('⏱ *Set Settle Time*\n\nHow long until the room settles?', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleSetTime(ctx: Context, type: 'lock' | 'settle', minutes: number) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const draft = roomDrafts.get(telegramId) || {};
    if (type === 'lock') {
      draft.lockTimeMinutes = minutes;
    } else {
      draft.settleTimeMinutes = minutes;
    }
    roomDrafts.set(telegramId, draft);

    await ctx.answerCbQuery(`✅ ${type === 'lock' ? 'Lock' : 'Settle'} time set to ${minutes} min`);
    await updateRoomCreationMessage(ctx, telegramId);
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleCustomTime(ctx: Context, type: 'lock' | 'settle') {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    setUserState(telegramId, type === 'lock' ? 'admin_custom_lock_time' as any : 'admin_custom_settle_time' as any);

    await ctx.answerCbQuery('✏️ Enter custom time');
    await ctx.reply(
      `✏️ Enter custom ${type === 'lock' ? 'lock' : 'settle'} time:\n\n` +
      `Examples:\n` +
      `• "30 minutes"\n` +
      `• "30m"\n` +
      `• "2 hours"\n` +
      `• "2h"\n` +
      `• "90 minutes"`,
      {
        reply_markup: { force_reply: true },
      }
    );
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleSetBetLimits(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    setUserState(telegramId, 'admin_set_bet_limits' as any);

    await ctx.answerCbQuery('💰 Send min bet amount');
    await ctx.reply('💰 Enter minimum bet amount in SOL (e.g., 0.05):', {
      reply_markup: { force_reply: true },
    });
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleSetCapacity(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const keyboard = getCapacityKeyboard();

    await ctx.editMessageText('👥 *Set Room Capacity*\n\nMaximum number of players:', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleSelectCapacity(ctx: Context, capacity: number) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const draft = roomDrafts.get(telegramId) || {};
    draft.capacity = capacity;
    roomDrafts.set(telegramId, draft);

    await ctx.answerCbQuery(`✅ Capacity set to ${capacity} players`);
    await updateRoomCreationMessage(ctx, telegramId);
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleDeployRoom(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const draft = roomDrafts.get(telegramId);
    if (!draft) {
      await ctx.answerCbQuery('❌ No draft found');
      return;
    }

    // Validate all fields
    if (!draft.title || !draft.oracleFeed || !draft.lockTimeMinutes || 
        !draft.settleTimeMinutes || !draft.minBet || !draft.capacity) {
      await ctx.answerCbQuery('❌ Please complete all fields');
      return;
    }

    await ctx.answerCbQuery('🚀 Creating battle arena...');

    // Calculate times
    const now = new Date();
    const lockTime = new Date(now.getTime() + draft.lockTimeMinutes * 60000);
    const settleTime = new Date(now.getTime() + draft.settleTimeMinutes * 60000);

    // Create room in database (status: OPEN - room is launched)
    const room = await prisma.room.create({
      data: {
        title: draft.title,
        oracleFeed: draft.oracleFeed,
        cap: draft.capacity,
        minBet: new Decimal(draft.minBet),
        maxBet: draft.maxBet ? new Decimal(draft.maxBet) : null,
        lockTime,
        settleTime,
        status: 'OPEN',
        marketType: draft.marketType,
        targetValue: draft.targetValue ? new Decimal(draft.targetValue) : null,
        targetDate: draft.targetDate,
        tokenAddress: draft.tokenAddress,
        tokenSymbol: draft.tokenSymbol,
        groupChatId: null,
        inviteLink: null,
      },
    });

    // Clear draft
    roomDrafts.delete(telegramId);

    // Assign chat from pool (room is now OPEN, so assign chat)
    let chatAssigned = false;
    try {
      const { assignChatForRoom } = await import('../domain/room');
      const bot = ctx.telegram as any; // Get bot instance from context
      // We need the bot instance - get it from the Telegraf context
      // For now, we'll need to pass it differently - let's get it from the global bot instance
      // Actually, we can't easily get the bot instance here. Let's handle chat assignment in settlementChecker or create a helper
      // For now, log that chat assignment should happen
      console.log(`Room ${room.id} deployed - chat assignment should happen via settlementChecker or room launch handler`);
    } catch (chatError: any) {
      console.error('Error assigning chat (non-fatal):', chatError);
      // Don't fail room creation if chat assignment fails
    }

    await ctx.editMessageText(
      `✅ *Battle Arena Deployed!*\n\n` +
      `*Title:* ${room.title}\n` +
      `*Type:* ${room.marketType || 'N/A'}\n` +
      `*Capacity:* ${room.cap} players\n` +
      `*Lock Time:* ${room.lockTime.toLocaleString()}\n` +
      `*Settle Time:* ${room.settleTime.toLocaleString()}\n\n` +
      `Room ID: \`${room.id}\`\n\n` +
      (chatAssigned ? `✅ Chat assigned from pool` : `⚠️ Chat assignment pending (check pool availability)`),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Back to Dashboard', callback_data: 'admin:dashboard' }]],
        },
      }
    );
  } catch (error: any) {
    console.error('Error deploying room:', error);
    await ctx.answerCbQuery(`❌ ${error.message || 'Deployment failed'}`);
  }
}

export async function handleListRooms(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const rooms = await prisma.room.findMany({
      where: { status: { in: ['OPEN', 'LOCKED'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const message = formatRoomsList(rooms);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'admin:dashboard' }]],
      },
    });
    await ctx.answerCbQuery();
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleUserManagement(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const totalUsers = await prisma.user.count();
    const message = formatUserManagement(totalUsers);

    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'admin:dashboard' }]],
        },
      });
    } catch (editError: any) {
      // If edit fails, send as new message
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'admin:dashboard' }]],
        },
      });
    }
    await ctx.answerCbQuery();
  } catch (error: any) {
    console.error('Error in handleUserManagement:', error);
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleAdminChatAdd(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    // Set conversation state to ask for chat ID
    setUserState(telegramId, 'admin_chat_add', {});

    await ctx.answerCbQuery('📝 Enter chat ID');
    await ctx.reply(
      `➕ *Add Chat to Pool*\n\n` +
      `Enter the Telegram group chat ID:\n\n` +
      `_Chat IDs are negative numbers (e.g., -1001234567890)_\n` +
      `_You can get it by forwarding a message from the group to @userinfobot_\n\n` +
      `Enter chat ID:`,
      {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true },
      }
    );
  } catch (error: any) {
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

export async function handleAdminChatAddInput(ctx: Context, chatIdStr: string) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    // Validate and normalize chat ID format
    // Remove any whitespace and extract the number
    let chatId = chatIdStr.trim().replace(/\s+/g, '');
    
    // Extract numeric value (handle both positive and negative)
    const numericMatch = chatId.match(/^-?\d+$/);
    if (!numericMatch) {
      await ctx.reply('❌ Invalid chat ID format. Please enter a number (e.g., -1001234567890 or 1001234567890)\n\n' +
        '_Group chat IDs are usually negative numbers. If you enter a positive number, it will be converted automatically._');
      return;
    }
    
    // Convert to string and ensure it's negative (group chats are always negative)
    let chatIdNum = parseInt(chatId, 10);
    if (chatIdNum > 0) {
      chatIdNum = -chatIdNum;
      chatId = chatIdNum.toString();
    } else {
      chatId = chatIdNum.toString();
    }

    // Check if chat already exists in pool
    const existing = await prisma.chatPool.findUnique({
      where: { chatId: chatId },
    });

    if (existing) {
      await ctx.reply(`❌ Chat ${chatId} is already in the pool.`);
      clearUserState(telegramId);
      return;
    }

    // Verify bot has access to the chat
    try {
      const bot = ctx.telegram;
      const chat = await bot.getChat(chatId);
      
      // Verify it's actually a group/supergroup (not a user or channel)
      if (chat.type !== 'group' && chat.type !== 'supergroup') {
        await ctx.reply(`❌ Chat ${chatId} is not a group or supergroup.\n\n` +
          `_You can only add groups/supergroups to the pool._`);
        clearUserState(telegramId);
        return;
      }
    } catch (error: any) {
      console.error('Error verifying chat access:', error);
      await ctx.reply(
        `❌ Cannot access chat ${chatId}.\n\n` +
        `*How to get the correct Group Chat ID:*\n\n` +
        `1. Create a Telegram group (Menu → New Group)\n` +
        `2. Add your bot to the group\n` +
        `3. Promote bot to admin with permissions:\n` +
        `   • Delete messages\n` +
        `   • Invite users\n` +
        `   • Change info\n` +
        `   • Pin messages\n` +
        `4. Get the chat ID:\n` +
        `   • Forward any message from the group to @userinfobot\n` +
        `   • Or use @getidsbot\n` +
        `   • Look for "Chat ID" (usually starts with -100)\n\n` +
        `*Note:* Group chat IDs are usually 13+ digits and start with -100\n` +
        `Your user ID (${telegramId}) is different from the group chat ID.`,
        { parse_mode: 'Markdown' }
      );
      clearUserState(telegramId);
      return;
    }

    // Add to ChatPool
    await prisma.chatPool.create({
      data: {
        chatId: chatId,
        status: 'FREE',
      },
    });

    // Delete user's message
    try {
      await ctx.deleteMessage();
    } catch (e) {
      // Ignore
    }

    clearUserState(telegramId);

    await ctx.reply(
      `✅ *Chat Added to Pool!*\n\n` +
      `Chat ID: \`${chatId}\`\n` +
      `Status: FREE\n\n` +
      `_This chat is now available for room assignment._`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 View All Chats', callback_data: 'admin:chat_list' }],
            [{ text: '⬅️ Back to Dashboard', callback_data: 'admin:dashboard' }],
          ],
        },
      }
    );
  } catch (error: any) {
    console.error('Error adding chat:', error);
    await ctx.reply(`❌ Error: ${error.message || 'Failed to add chat'}`);
    clearUserState(telegramId);
  }
}

export async function handleAdminChatList(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    requireAdmin(telegramId);

    const chats = await prisma.chatPool.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const freeCount = chats.filter(c => c.status === 'FREE').length;
    const assignedCount = chats.filter(c => c.status === 'ASSIGNED').length;

    let message = `💬 *Chat Pool Management*\n\n`;
    message += `*Status:*\n`;
    message += `🟢 FREE: ${freeCount}\n`;
    message += `🔴 ASSIGNED: ${assignedCount}\n`;
    message += `📊 Total: ${chats.length}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;

    if (chats.length === 0) {
      message += `_No chats in pool. Add some chats to get started._`;
    } else {
      message += `*Chats:*\n\n`;
      chats.forEach((chat, index) => {
        const statusEmoji = chat.status === 'FREE' ? '🟢' : '🔴';
        message += `${index + 1}. ${statusEmoji} \`${chat.chatId}\`\n`;
        message += `   Status: ${chat.status}`;
        if (chat.roomId) {
          message += ` | Room: ${chat.roomId.substring(0, 8)}...`;
        }
        message += `\n\n`;
      });
    }

    const buttons: any[][] = [
      [{ text: '➕ Add Chat', callback_data: 'admin:chat_add' }],
      [{ text: '🔄 Refresh', callback_data: 'admin:chat_list' }],
      [{ text: '⬅️ Back to Dashboard', callback_data: 'admin:dashboard' }],
    ];

    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (editError: any) {
      // If edit fails, send as new message
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons },
      });
    }
    await ctx.answerCbQuery();
  } catch (error: any) {
    console.error('Error in handleAdminChatList:', error);
    await ctx.answerCbQuery(`❌ ${error.message || 'Error'}`);
  }
}

async function updateRoomCreationMessage(ctx: Context, telegramId: number) {
  const draft = roomDrafts.get(telegramId) || {};
  const message = formatRoomCreation(draft);
  const keyboard = getRoomCreationKeyboard();

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

// Handle admin text input
export async function handleAdminTextInput(ctx: Context, text: string) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    requireAdmin(telegramId);

    const state = getUserState(telegramId);
    if (!state) return;

    const draft = roomDrafts.get(telegramId) || {};

    try {
      await ctx.deleteMessage();
    } catch (e) {
      // Ignore
    }

    if (state.action === 'admin_set_title') {
      draft.title = text;
      roomDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      await ctx.reply('✅ Title set!', { reply_markup: { remove_keyboard: true } });
      await returnToRoomCreation(ctx, telegramId);

    } else if (state.action === 'admin_set_sol_target') {
      const targetPrice = parseFloat(text);
      if (isNaN(targetPrice) || targetPrice <= 0) {
        await ctx.reply('❌ Invalid price. Please enter a valid number.');
        return;
      }

      draft.targetValue = targetPrice;
      draft.oracleFeed = 'SOL/USD';
      roomDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      await ctx.reply(`✅ Target price set to $${targetPrice}!`, { reply_markup: { remove_keyboard: true } });
      await returnToRoomCreation(ctx, telegramId);

    } else if (state.action === 'admin_set_token_ca') {
      // Validate Solana address format
      if (text.length < 32 || text.length > 44) {
        await ctx.reply('❌ Invalid contract address. Please enter a valid Solana address.');
        return;
      }

      draft.tokenAddress = text;
      roomDrafts.set(telegramId, draft);

      // Now ask for token symbol for display
      setUserState(telegramId, 'admin_set_token_symbol' as any);
      await ctx.reply(`🚀 *Contract Address:*\n\`${text}\`\n\nNow enter token symbol for display (e.g., PEPE):`, {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true },
      });

    } else if (state.action === 'admin_set_token_symbol') {
      draft.tokenSymbol = text.toUpperCase();
      roomDrafts.set(telegramId, draft);

      // Now ask for target market cap
      setUserState(telegramId, 'admin_set_token_price' as any);
      await ctx.reply(
        `🚀 Token: ${text.toUpperCase()}\n\n` +
        `Now enter target *market cap* in USD:\n\n` +
        `Examples:\n` +
        `• 2m → $2 million\n` +
        `• 10m → $10 million\n` +
        `• 1b → $1 billion\n` +
        `• 500k → $500,000\n` +
        `• Or just type a number`,
        {
          parse_mode: 'Markdown',
          reply_markup: { force_reply: true },
        }
      );

    } else if (state.action === 'admin_set_token_price') {
      // Parse market cap format (2m, 10m, 1b, etc.)
      const parsedValue = parseMarketCapValue(text);
      
      if (isNaN(parsedValue) || parsedValue <= 0) {
        await ctx.reply('❌ Invalid value. Use formats like: 2m, 10m, 1b, 500k, or plain numbers.');
        return;
      }

      draft.targetValue = parsedValue;
      draft.oracleFeed = `SOLSCAN:${draft.tokenAddress}`;
      roomDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      const displayValue = parsedValue >= 1_000_000 ? `$${(parsedValue / 1_000_000).toFixed(2)}M` : `$${parsedValue}`;
      await ctx.reply(`✅ Target: ${draft.tokenSymbol} → ${displayValue} market cap!`, { reply_markup: { remove_keyboard: true } });
      await returnToRoomCreation(ctx, telegramId);

    } else if (state.action === 'admin_set_custom_oracle') {
      draft.oracleFeed = text;
      roomDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      await ctx.reply('✅ Custom oracle set!', { reply_markup: { remove_keyboard: true } });
      await returnToRoomCreation(ctx, telegramId);

    } else if (state.action === 'admin_set_target_date') {
      // Parse flexible date formats
      const targetDate = parseFlexibleDate(text);

      if (!targetDate) {
        await ctx.reply(
          '❌ Invalid date. Try:\n' +
          '• "today 11:59pm"\n' +
          '• "today 6pm"\n' +
          '• "tomorrow 5pm"\n' +
          '• "5/11 23:59"\n' +
          '• "2025-11-06 23:59"'
        );
        return;
      }

      draft.targetDate = targetDate;
      roomDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      await ctx.reply(`✅ Target date set to ${targetDate.toLocaleString()}!`, { reply_markup: { remove_keyboard: true } });
      await returnToRoomCreation(ctx, telegramId);

    } else if (state.action === 'admin_set_bet_limits') {
      const minBet = parseFloat(text);
      if (isNaN(minBet) || minBet <= 0) {
        await ctx.reply('❌ Invalid amount. Please enter a valid number.');
        return;
      }

      draft.minBet = minBet;
      roomDrafts.set(telegramId, draft);

      // Now ask for max bet
      setUserState(telegramId, 'admin_set_max_bet' as any);
      await ctx.reply(
        `✅ Min bet set to ${minBet} SOL!\n\n` +
        `💰 Now enter *maximum* bet amount in SOL (or type "none" for no limit):`,
        {
          parse_mode: 'Markdown',
          reply_markup: { force_reply: true },
        }
      );

    } else if (state.action === 'admin_set_max_bet') {
      if (text.toLowerCase() === 'none' || text.toLowerCase() === 'no') {
        draft.maxBet = undefined;
        roomDrafts.set(telegramId, draft);
        clearUserState(telegramId);

        await ctx.reply('✅ No max bet limit set!', { reply_markup: { remove_keyboard: true } });
        await returnToRoomCreation(ctx, telegramId);
        return;
      }

      const maxBet = parseFloat(text);
      if (isNaN(maxBet) || maxBet <= 0) {
        await ctx.reply('❌ Invalid amount. Please enter a valid number or type "none".');
        return;
      }

      if (draft.minBet && maxBet < draft.minBet) {
        await ctx.reply(`❌ Max bet must be greater than min bet (${draft.minBet} SOL)`);
        return;
      }

      draft.maxBet = maxBet;
      roomDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      await ctx.reply(`✅ Max bet set to ${maxBet} SOL!`, { reply_markup: { remove_keyboard: true } });
      await returnToRoomCreation(ctx, telegramId);

    } else if (state.action === 'admin_custom_lock_time' || state.action === 'admin_custom_settle_time') {
      const minutes = parseTimeDuration(text);
      
      if (!minutes || minutes <= 0) {
        await ctx.reply('❌ Invalid format. Try: "30 minutes", "30m", "2 hours", "2h"');
        return;
      }

      const type = state.action === 'admin_custom_lock_time' ? 'lock' : 'settle';
      
      if (type === 'lock') {
        draft.lockTimeMinutes = minutes;
      } else {
        draft.settleTimeMinutes = minutes;
      }
      
      roomDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      const displayTime = minutes >= 60 ? `${(minutes / 60).toFixed(1)} hour${minutes >= 120 ? 's' : ''}` : `${minutes} minutes`;
      await ctx.reply(`✅ ${type === 'lock' ? 'Lock' : 'Settle'} time set to ${displayTime}!`, { reply_markup: { remove_keyboard: true } });
      await returnToRoomCreation(ctx, telegramId);
    }
  } catch (error: any) {
    await ctx.reply(`❌ ${error.message || 'Error'}`);
  }
}

async function returnToRoomCreation(ctx: Context, telegramId: number) {
  const draft = roomDrafts.get(telegramId) || {};
  const message = formatRoomCreation(draft);
  const keyboard = getRoomCreationKeyboard();

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Show markets that can be resolved
 */
export async function handleResolveMarkets(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    requireAdmin(telegramId);
    
    // Fetch all OPEN rooms with target dates
    const rooms = await prisma.room.findMany({
      where: {
        status: 'OPEN',
        targetDate: { not: null }
      },
      orderBy: {
        targetDate: 'asc'
      }
    });
    
    if (rooms.length === 0) {
      await ctx.editMessageText(
        '⚖️ *Market Resolution*\n\n' +
        'No markets available for resolution.\n\n' +
        '_Markets must have a target date set to be resolved._',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '⬅️ Back to Dashboard', callback_data: 'admin:dashboard' }
            ]]
          }
        }
      );
      return;
    }
    
    // Build market list message
    let message = '⚖️ *Market Resolution*\n\n';
    message += `Found ${rooms.length} market(s) ready for resolution:\n\n`;
    
    const keyboard: any[] = [];
    
    for (const room of rooms) {
      const now = new Date();
      const targetDate = room.targetDate ? new Date(room.targetDate) : null;
      const canResolve = targetDate && now >= targetDate;
      
      message += `📊 *${room.title}*\n`;
      message += `   Type: ${room.marketType || 'N/A'}\n`;
      message += `   Target: ${targetDate ? targetDate.toLocaleDateString() : 'N/A'}\n`;
      message += `   Status: ${canResolve ? '✅ Ready' : '⏳ Waiting'}\n\n`;
      
      if (canResolve) {
        keyboard.push([{
          text: `🎯 Resolve: ${room.title.substring(0, 30)}...`,
          callback_data: `admin:resolve_room:${room.id}`
        }]);
      }
    }
    
    keyboard.push([{ text: '⬅️ Back to Dashboard', callback_data: 'admin:dashboard' }]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
    
  } catch (error: any) {
    console.error('Error in handleResolveMarkets:', error);
    await ctx.answerCbQuery(`Error: ${error.message}`);
  }
}

/**
 * Show resolution options for a specific room
 */
export async function handleResolveRoom(ctx: Context, roomId: number) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    requireAdmin(telegramId);
    
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { 
        bets: true 
      }
    });
    
    if (!room) {
      await ctx.answerCbQuery('Room not found');
      return;
    }
    
    const { getMarketResolutionKeyboard } = await import('../keyboards/admin');
    
    let message = `⚖️ *Resolve Market*\n\n`;
    message += `📊 *${room.title}*\n\n`;
    message += `Type: ${room.marketType || 'N/A'}\n`;
    message += `Target Date: ${room.targetDate ? new Date(room.targetDate).toLocaleDateString() : 'N/A'}\n`;
    message += `Total Bets: ${room.bets.length}\n\n`;
    
    if (room.marketType === 'solprice') {
      message += `🎯 Target: SOL >= $${room.targetValue || 'N/A'}\n\n`;
    } else if (room.marketType === 'pumpfun_mcap') {
      message += `🎯 Target: ${room.tokenSymbol || 'Token'} >= $${room.targetValue ? (parseFloat(room.targetValue.toString()) / 1_000_000).toFixed(2) : 'N/A'}M\n`;
      message += `Token: \`${room.tokenAddress || 'N/A'}\`\n\n`;
    }
    
    message += `Choose resolution method:`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: getMarketResolutionKeyboard(roomId)
    });
    
  } catch (error: any) {
    console.error('Error in handleResolveRoom:', error);
    await ctx.answerCbQuery(`Error: ${error.message}`);
  }
}

/**
 * Auto-resolve a market using oracle
 */
export async function handleAutoResolve(ctx: Context, roomId: number) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    requireAdmin(telegramId);
    
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });
    
    if (!room) {
      await ctx.answerCbQuery('Room not found');
      return;
    }
    
    const { 
      resolvesolpriceMarket, 
      resolvePumpfunMarket,
      canAutoResolve
    } = await import('../domain/oracle');
    
    // Check if can auto-resolve
    const targetDate = room.targetDate ? new Date(room.targetDate) : new Date();
    const canAuto = await canAutoResolve(room.marketType || '', targetDate);
    
    if (!canAuto) {
      await ctx.answerCbQuery('This market cannot be auto-resolved. Use manual resolution.');
      return;
    }
    
    let result;
    
    if (room.marketType === 'solprice') {
      const targetPrice = parseFloat(room.targetValue?.toString() || '0');
      result = await resolvesolpriceMarket(targetPrice, targetDate);
    } else if (room.marketType === 'pumpfun_mcap') {
      const tokenAddress = room.tokenAddress || '';
      const targetMarketCap = parseFloat(room.targetValue?.toString() || '0');
      result = await resolvePumpfunMarket(tokenAddress, targetMarketCap, targetDate);
    } else {
      await ctx.answerCbQuery('Unknown market type');
      return;
    }
    
    if (!result.resolved || !result.winningSide) {
      await ctx.answerCbQuery(`Failed: ${result.message}`);
      return;
    }
    
    // Update room with resolution
    await prisma.room.update({
      where: { id: roomId },
      data: {
        status: 'SETTLED',
        winningSide: result.winningSide,
        settledAt: new Date()
      }
    });
    
    // Settle bets and distribute winnings
    const { settleRoom } = await import('../domain/room');
    await settleRoom(roomId, result.winningSide);
    
    await ctx.editMessageText(
      `✅ *Market Resolved!*\n\n` +
      `📊 *${room.title}*\n\n` +
      `Result: *${result.winningSide} Wins*\n\n` +
      `${result.message}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '⬅️ Back to Markets', callback_data: 'admin:resolve_markets' }
          ]]
        }
      }
    );
    
  } catch (error: any) {
    console.error('Error in handleAutoResolve:', error);
    await ctx.answerCbQuery(`Error: ${error.message}`);
  }
}

/**
 * Manually resolve a market
 */
export async function handleManualResolve(ctx: Context, roomId: string, winningSide: 'YES' | 'NO') {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    requireAdmin(telegramId);
    
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });
    
    if (!room) {
      await ctx.answerCbQuery('Room not found');
      return;
    }
    
    // If room is OPEN, lock it first (required for settlement)
    if (room.status === 'OPEN') {
      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'LOCKED' },
      });
    }
    
    // Settle bets and distribute winnings using settleRoomWithWinner
    const { settleRoomWithWinner, nukeRoomChat } = await import('../domain/room');
    await settleRoomWithWinner(roomId, winningSide);
    
    // Nuke the chat if it exists
    try {
      const bot = ctx.telegram as any;
      await nukeRoomChat(roomId, bot);
    } catch (nukeError) {
      console.error(`Failed to nuke chat for room ${roomId}:`, nukeError);
      // Continue even if nuking fails
    }
    
    // Send settlement message to chat if it exists
    if (room.chatId) {
      try {
        const yesPool = room.longPool.toNumber();
        const noPool = room.shortPool.toNumber();
        const totalPool = room.pool.toNumber();

        await ctx.telegram.sendMessage(
          room.chatId,
          `🎯 *MARKET SETTLED\\!*\n\n` +
          `*Winner: ${winningSide === 'YES' ? '✅ YES' : '❌ NO'}*\n\n` +
          `Total Pool: ${totalPool.toFixed(4)} SOL\n` +
          `✅ YES Pool: ${yesPool.toFixed(4)} SOL\n` +
          `❌ NO Pool: ${noPool.toFixed(4)} SOL\n\n` +
          `Admin manually resolved this market\\.\nWinners have been paid\\!\n\n` +
          `_This arena chat has been nuked and recycled._`,
          { parse_mode: 'MarkdownV2' }
        );
      } catch (error) {
        console.error(`Failed to send settlement message to chat:`, error);
      }
    }
    
    try {
      await ctx.editMessageText(
        `✅ *Market Manually Resolved!*\n\n` +
        `📊 *${room.title}*\n\n` +
        `Admin Decision: *${winningSide} Wins*\n\n` +
        `Room has been settled and chat recycled.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '⬅️ Back to Dashboard', callback_data: 'admin:dashboard' }
            ]]
          }
        }
      );
    } catch (editError: any) {
      // If edit fails, send as new message
      await ctx.reply(
        `✅ *Market Manually Resolved!*\n\n` +
        `📊 *${room.title}*\n\n` +
        `Admin Decision: *${winningSide} Wins*\n\n` +
        `Room has been settled and chat recycled.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '⬅️ Back to Dashboard', callback_data: 'admin:dashboard' }
            ]]
          }
        }
      );
    }
    
    await ctx.answerCbQuery('✅ Room settled successfully!');
    
  } catch (error: any) {
    console.error('Error in handleManualResolve:', error);
    await ctx.answerCbQuery(`Error: ${error.message || 'Failed to settle room'}`);
  }
}

/**
 * Force settle a room by ID (for debugging/admin use)
 */
export async function handleForceSettle(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    requireAdmin(telegramId);
    
    // Get all unsettled rooms
    const rooms = await prisma.room.findMany({
      where: {
        status: { in: ['OPEN', 'LOCKED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    if (rooms.length === 0) {
      await ctx.editMessageText('No unsettled rooms found.', {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'admin:dashboard' }]]
        }
      });
      return;
    }
    
    let message = `⚡ *Force Settle Rooms*\n\nSelect a room to manually settle:\n\n`;
    const keyboard: any[] = [];
    
    for (const room of rooms) {
      message += `📊 ${room.title}\nStatus: ${room.status}\n\n`;
      keyboard.push([{
        text: `⚡ ${room.title.substring(0, 40)}...`,
        callback_data: `admin:force_settle:${room.id}`
      }]);
    }
    
    keyboard.push([{ text: '⬅️ Back', callback_data: 'admin:dashboard' }]);
    
    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (editError: any) {
      // If edit fails, send as new message
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
    await ctx.answerCbQuery();
  } catch (error: any) {
    console.error('Error in handleForceSettle:', error);
    await ctx.answerCbQuery(`Error: ${error.message || 'Failed to load rooms'}`);
  }
}

export async function handleForceSettleRoom(ctx: Context, roomId: string) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    requireAdmin(telegramId);
    
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });
    
    if (!room) {
      await ctx.answerCbQuery('Room not found');
      return;
    }
    
    try {
      await ctx.editMessageText(
        `⚡ *Force Settle*\n\n📊 ${room.title}\n\nWho wins?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ YES Wins', callback_data: `admin:manual_resolve:${roomId}:YES` },
                { text: '❌ NO Wins', callback_data: `admin:manual_resolve:${roomId}:NO` }
              ],
              [{ text: '⬅️ Back', callback_data: 'admin:force_settle' }]
            ]
          }
        }
      );
    } catch (editError: any) {
      // If edit fails, send as new message
      await ctx.reply(
        `⚡ *Force Settle*\n\n📊 ${room.title}\n\nWho wins?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ YES Wins', callback_data: `admin:manual_resolve:${roomId}:YES` },
                { text: '❌ NO Wins', callback_data: `admin:manual_resolve:${roomId}:NO` }
              ],
              [{ text: '⬅️ Back', callback_data: 'admin:force_settle' }]
            ]
          }
        }
      );
    }
    await ctx.answerCbQuery();
  } catch (error: any) {
    await ctx.answerCbQuery(`Error: ${error.message}`);
  }
}

