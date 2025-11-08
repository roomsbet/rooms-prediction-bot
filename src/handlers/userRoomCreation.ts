/**
 * User Room Creation Handlers - Simplified room creation for regular users
 */

import { Context } from 'telegraf';
import { prisma } from '../infra/db';
import { setUserState, getUserState, clearUserState } from '../utils/conversationState';
import { formatUserRoomCreation, UserRoomDraft } from '../messages/userRoomCreation';
import { getUserRoomKeyboard, getUserMarketTypeKeyboard, getSettleTimeKeyboard } from '../keyboards/userRoomCreation';
import { Decimal } from '@prisma/client/runtime/library';
import { validateCoinSymbol } from '../infra/price';

// Store room drafts per user
const userDrafts = new Map<number, UserRoomDraft>();

// Store the last message ID for each user's room creation flow
const userRoomCreationMessageIds = new Map<number, number>();

/**
 * Parse market cap values like "2m", "10m", "1b", "500k"
 */
function parseMarketCapValue(input: string): number {
  const text = input.toLowerCase().trim();
  const match = text.match(/^([\d.]+)\s*([kmb])$/);
  
  if (match) {
    const value = parseFloat(match[1]);
    const suffix = match[2];
    
    switch (suffix) {
      case 'k': return value * 1_000;
      case 'm': return value * 1_000_000;
      case 'b': return value * 1_000_000_000;
    }
  }
  
  return parseFloat(text);
}

/**
 * Start user room creation
 */
export async function handleUserCreateStart(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Initialize draft
    userDrafts.set(telegramId, {});

    const message = formatUserRoomCreation({});
    const keyboard = getUserRoomKeyboard({});

    // Store message ID if we're editing an existing message
    if (ctx.callbackQuery && ctx.callbackQuery.message && 'message_id' in ctx.callbackQuery.message) {
      const messageId = ctx.callbackQuery.message.message_id;
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      userRoomCreationMessageIds.set(telegramId, messageId);
    } else {
      // Send new message and store its ID
      const sentMessage = await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      userRoomCreationMessageIds.set(telegramId, sentMessage.message_id);
    }
    
    await ctx.answerCbQuery();
  } catch (error: any) {
    console.error('Error in handleUserCreateStart:', error);
    await ctx.answerCbQuery('❌ Error');
  }
}

/**
 * Show market type selection
 */
export async function handleUserSetMarket(ctx: Context) {
  try {
    const keyboard = getUserMarketTypeKeyboard();
    await ctx.editMessageText('📊 *Select Market Type*', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error: any) {
    await ctx.answerCbQuery('❌ Error');
  }
}

/**
 * Handle market type selection
 */
export async function handleUserSelectMarket(ctx: Context, marketType: string) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const draft = userDrafts.get(telegramId) || {};
    draft.marketType = marketType as 'coin_price' | 'pumpfun_mcap';
    userDrafts.set(telegramId, draft);

    // If coin_price, immediately ask for coin symbol
    if (marketType === 'coin_price') {
      setUserState(telegramId, 'user_room_coin_symbol');
      await ctx.answerCbQuery('💰 Enter coin symbol');
      await ctx.reply(
        '💰 *Which coin do you want to track?*\n\n' +
        'Examples: BTC, ETH, SOL, PEPE, DOGE\n\n' +
        'Enter the coin symbol:',
        {
          parse_mode: 'Markdown',
          reply_markup: { force_reply: true },
        }
      );
    } else {
      await ctx.answerCbQuery('✅ Market type selected');
      await updateUserRoomCreation(ctx, telegramId);
    }
  } catch (error: any) {
    await ctx.answerCbQuery('❌ Error');
  }
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
 * Handle Custom Oracle "Soon" button
 */
export async function handleCustomSoon(ctx: Context) {
  await ctx.answerCbQuery('🔜 Custom oracles coming soon!', { show_alert: true });
}

/**
 * Handle track type selection (price vs market cap)
 */
export async function handleUserSelectTrackType(ctx: Context, trackType: 'price' | 'market_cap') {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const draft = userDrafts.get(telegramId);
    if (!draft) {
      await ctx.answerCbQuery('❌ Error');
      return;
    }

    draft.coinTrackType = trackType;
    userDrafts.set(telegramId, draft);

    await ctx.answerCbQuery(`✅ Tracking ${trackType === 'price' ? 'Price' : 'Market Cap'}`);
    await updateUserRoomCreation(ctx, telegramId);
  } catch (error: any) {
    await ctx.answerCbQuery('❌ Error');
  }
}

/**
 * Handle custom time selection
 */
export async function handleUserCustomTime(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    setUserState(telegramId, 'user_room_custom_time');
    await ctx.answerCbQuery('⏱️ Enter custom time');
    await ctx.reply(
      '⏱️ *Enter Custom Settle Time*\n\n' +
      'Examples:\n' +
      '• 45 minutes\n' +
      '• 90 minutes\n' +
      '• 3 hours\n' +
      '• 6 hours\n' +
      '• Or just: 45m, 2h, etc.',
      {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true },
      }
    );
  } catch (error: any) {
    await ctx.answerCbQuery('❌ Error');
  }
}

/**
 * Set title
 */
export async function handleUserSetTitle(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    setUserState(telegramId, 'user_room_title');
    await ctx.answerCbQuery('📝 Enter room title');
    await ctx.reply('📝 Enter the room title:', {
      reply_markup: { force_reply: true },
    });
  } catch (error: any) {
    await ctx.answerCbQuery('❌ Error');
  }
}

/**
 * Set target
 */
export async function handleUserSetTarget(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const draft = userDrafts.get(telegramId);
    if (!draft || !draft.marketType) {
      await ctx.answerCbQuery('❌ Select market type first');
      return;
    }

    if (draft.marketType === 'coin_price') {
      if (!draft.coinSymbol) {
        await ctx.answerCbQuery('❌ Select market type first to set coin');
        return;
      }

      // Ask what they want to track: price or market cap
      if (!draft.coinTrackType) {
        await ctx.editMessageText(
          `📊 *What do you want to track for ${draft.coinSymbol}?*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 Price (USD)', callback_data: 'user:track:price' }],
                [{ text: '📊 Market Cap (USD)', callback_data: 'user:track:market_cap' }],
                [{ text: '⬅️ Back', callback_data: 'user:create_start' }]
              ]
            }
          }
        );
        await ctx.answerCbQuery();
      } else {
        // Track type already set, ask for target value
        setUserState(telegramId, 'user_room_target');
        await ctx.answerCbQuery('🎯 Enter target value');
        
        const trackLabel = draft.coinTrackType === 'price' ? 'price' : 'market cap';
        const example = draft.coinTrackType === 'price'
          ? (draft.coinSymbol === 'BTC' ? '100000' : draft.coinSymbol === 'ETH' ? '5000' : '100')
          : '5000000000';
        
        await ctx.reply(
          `🎯 Enter target ${trackLabel} for ${draft.coinSymbol}\n\n` +
          `${draft.coinTrackType === 'market_cap' ? 'You can use: 5b, 500m, 10m, etc.\n' : ''}` +
          `Example: ${example}`,
          {
            reply_markup: { force_reply: true },
          }
        );
      }
    } else if (draft.marketType === 'pumpfun_mcap') {
      setUserState(telegramId, 'user_room_token_ca');
      await ctx.answerCbQuery('🪙 Enter token address');
      await ctx.reply('🚀 Enter token contract address:', {
        reply_markup: { force_reply: true },
      });
    }
  } catch (error: any) {
    await ctx.answerCbQuery('❌ Error');
  }
}

/**
 * Set settle time
 */
export async function handleUserSetTime(ctx: Context) {
  try {
    const keyboard = getSettleTimeKeyboard();
    await ctx.editMessageText('⏱️ *Select Settle Time*\n\nHow long until settlement?', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error: any) {
    await ctx.answerCbQuery('❌ Error');
  }
}

/**
 * Handle settle time selection
 */
export async function handleUserSelectTime(ctx: Context, minutes: string) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const draft = userDrafts.get(telegramId) || {};
    draft.settleTimeMinutes = parseInt(minutes);
    userDrafts.set(telegramId, draft);

    await ctx.answerCbQuery('✅ Settle time selected');
    await updateUserRoomCreation(ctx, telegramId);
  } catch (error: any) {
    await ctx.answerCbQuery('❌ Error');
  }
}

/**
 * Deploy room
 */
export async function handleUserDeploy(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const draft = userDrafts.get(telegramId);
    if (!draft) {
      await ctx.answerCbQuery('❌ No draft found');
      return;
    }

    // Validate all fields
    if (!draft.title || !draft.marketType || !draft.targetValue || !draft.settleTimeMinutes) {
      await ctx.answerCbQuery('❌ Complete all fields first');
      return;
    }

    if (draft.marketType === 'coin_price' && (!draft.coinSymbol || !draft.coinTrackType)) {
      await ctx.answerCbQuery('❌ Complete coin information');
      return;
    }

    if (draft.marketType === 'pumpfun_mcap' && (!draft.tokenAddress || !draft.tokenSymbol)) {
      await ctx.answerCbQuery('❌ Complete token information');
      return;
    }

    await ctx.answerCbQuery('🚀 Creating room...');

    // Calculate times - ensure we're using future times
    const now = new Date();
    const settleTime = new Date(now.getTime() + draft.settleTimeMinutes * 60000);
    const lockTime = new Date(settleTime.getTime() - 5 * 60000); // Auto: 5 min before

    console.log(`Creating room with settle time: ${settleTime.toISOString()} (${draft.settleTimeMinutes} minutes from now)`);

    // Create room - determine market type based on coin track type
    let finalMarketType = draft.marketType;
    if (draft.marketType === 'coin_price' && draft.coinTrackType === 'market_cap') {
      finalMarketType = 'coin_mcap'; // Differentiate coin market cap from coin price
    }

    const oracleFeed = draft.marketType === 'coin_price' 
      ? `${draft.coinSymbol}/USD`
      : draft.marketType === 'pumpfun_mcap'
      ? `${draft.tokenSymbol}/USD`
      : 'SOL/USD';

    // Get the user who is creating the room
    const creator = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    const room = await prisma.room.create({
      data: {
        title: draft.title,
        oracleFeed,
        cap: 10, // Fixed
        minBet: new Decimal(0.10), // Fixed
        maxBet: new Decimal(5.00), // Fixed
        lockTime,
        settleTime,
        status: 'OPEN', // Ensure room starts as OPEN
        marketType: finalMarketType,
        targetValue: new Decimal(draft.targetValue),
        targetDate: settleTime, // Auto: same as settle time
        tokenAddress: draft.tokenAddress,
        tokenSymbol: draft.marketType === 'coin_price' ? draft.coinSymbol : draft.tokenSymbol,
        hostUserId: creator?.id, // Link to the creator
      },
    });

    console.log(`✅ Room created with ID ${room.id}, status: ${room.status}`);

    // Clear draft and message ID tracking
    userDrafts.delete(telegramId);
    userRoomCreationMessageIds.delete(telegramId);

    await ctx.editMessageText(
      `✅ *Room Created!*\n\n` +
      `*${room.title}*\n\n` +
      `Settles in ${draft.settleTimeMinutes} minutes\n` +
      `Players can start betting now!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏛️ View Room', callback_data: `cb:room_details:${room.id}` }],
            [{ text: '⬅️ Dashboard', callback_data: 'cb:back_dashboard' }]
          ]
        }
      }
    );
  } catch (error: any) {
    console.error('Error deploying user room:', error);
    await ctx.answerCbQuery(`❌ ${error.message || 'Deployment failed'}`);
  }
}

/**
 * Handle user text input for room creation
 */
export async function handleUserRoomTextInput(ctx: Context, text: string) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    const state = getUserState(telegramId);
    if (!state) return;

    const draft = userDrafts.get(telegramId) || {};

    try {
      await ctx.deleteMessage();
    } catch (e) {
      // Ignore
    }

    if (state.action === 'user_room_title') {
      draft.title = text;
      userDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      await ctx.reply('✅ Title set!', { reply_markup: { remove_keyboard: true } });
      await updateUserRoomCreation(ctx, telegramId);

    } else if (state.action === 'user_room_coin_symbol') {
      // Validate coin symbol
      const coinInfo = await validateCoinSymbol(text);
      
      if (!coinInfo) {
        await ctx.reply('❌ Coin not found. Please enter a valid coin symbol (e.g., BTC, ETH, SOL).');
        return;
      }

      draft.coinSymbol = coinInfo.symbol;
      draft.coinName = coinInfo.name;
      userDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      await ctx.reply(
        `✅ Coin identified: *${coinInfo.name}* (${coinInfo.symbol})\n\n` +
        `Coin added to your room configuration!`,
        {
          parse_mode: 'Markdown',
          reply_markup: { remove_keyboard: true },
        }
      );
      
      await updateUserRoomCreation(ctx, telegramId);

    } else if (state.action === 'user_room_target') {
      // Handle target value for coin_price markets
      if (draft.marketType === 'coin_price') {
        let targetValue: number;
        
        // If tracking market cap, allow formats like "5b", "500m"
        if (draft.coinTrackType === 'market_cap') {
          targetValue = parseMarketCapValue(text);
        } else {
          targetValue = parseFloat(text);
        }
        
        if (isNaN(targetValue) || targetValue <= 0) {
          await ctx.reply('❌ Invalid value. Please enter a valid number.');
          return;
        }

        draft.targetValue = targetValue;
        userDrafts.set(telegramId, draft);
        clearUserState(telegramId);

        const displayValue = draft.coinTrackType === 'market_cap'
          ? `$${targetValue >= 1_000_000_000 ? (targetValue / 1_000_000_000).toFixed(2) + 'B' : (targetValue / 1_000_000).toFixed(2) + 'M'}`
          : `$${targetValue.toFixed(2)}`;
        
        const trackLabel = draft.coinTrackType === 'price' ? 'price' : 'market cap';
        await ctx.reply(`✅ Target ${trackLabel} set to ${displayValue}!`, { reply_markup: { remove_keyboard: true } });
        await updateUserRoomCreation(ctx, telegramId);
      }

    } else if (state.action === 'user_room_token_ca') {
      if (text.length < 32 || text.length > 44) {
        await ctx.reply('❌ Invalid contract address. Please enter a valid Solana address.');
        return;
      }

      draft.tokenAddress = text;
      userDrafts.set(telegramId, draft);

      setUserState(telegramId, 'user_room_token_symbol');
      await ctx.reply(`🚀 *Contract Address:*\n\`${text}\`\n\nNow enter token symbol (e.g., PEPE):`, {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true },
      });

    } else if (state.action === 'user_room_token_symbol') {
      draft.tokenSymbol = text.toUpperCase();
      userDrafts.set(telegramId, draft);

      setUserState(telegramId, 'user_room_target');
      await ctx.reply(
        `🚀 Token: ${text.toUpperCase()}\n\n` +
        `Enter target *market cap*:\n\n` +
        `Examples: 2m, 10m, 1b, 500k, or plain numbers`,
        {
          parse_mode: 'Markdown',
          reply_markup: { force_reply: true },
        }
      );

    } else if (state.action === 'user_room_target' && draft.marketType === 'pumpfun_mcap') {
      const parsedValue = parseMarketCapValue(text);
      
      if (isNaN(parsedValue) || parsedValue <= 0) {
        await ctx.reply('❌ Invalid value. Use formats like: 2m, 10m, 1b, 500k, or plain numbers.');
        return;
      }

      draft.targetValue = parsedValue;
      userDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      const displayValue = parsedValue >= 1_000_000 ? `$${(parsedValue / 1_000_000).toFixed(2)}M` : `$${parsedValue}`;
      await ctx.reply(`✅ Target: ${draft.tokenSymbol} → ${displayValue} market cap!`, { reply_markup: { remove_keyboard: true } });
      await updateUserRoomCreation(ctx, telegramId);

    } else if (state.action === 'user_room_custom_time') {
      const parsedMinutes = parseTimeDuration(text);
      
      if (!parsedMinutes || parsedMinutes <= 0) {
        await ctx.reply('❌ Invalid time format. Try: "30 minutes", "2 hours", "45m", "3h"');
        return;
      }

      draft.settleTimeMinutes = parsedMinutes;
      userDrafts.set(telegramId, draft);
      clearUserState(telegramId);

      const hours = Math.floor(parsedMinutes / 60);
      const minutes = parsedMinutes % 60;
      const displayTime = hours > 0 
        ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim()
        : `${minutes}m`;
      
      await ctx.reply(`✅ Settle time set to ${displayTime}!`, { reply_markup: { remove_keyboard: true } });
      await updateUserRoomCreation(ctx, telegramId);
    }
  } catch (error: any) {
    console.error('Error in handleUserRoomTextInput:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
}

/**
 * Update room creation message
 */
async function updateUserRoomCreation(ctx: Context, telegramId: number) {
  const draft = userDrafts.get(telegramId) || {};
  const message = formatUserRoomCreation(draft);
  const keyboard = getUserRoomKeyboard(draft);

  try {
    // If we have a callback query context, try to edit that message
    if (ctx.callbackQuery && ctx.callbackQuery.message && 'message_id' in ctx.callbackQuery.message) {
      const messageId = ctx.callbackQuery.message.message_id;
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      userRoomCreationMessageIds.set(telegramId, messageId);
    } 
    // If we have a stored message ID, try to edit it
    else if (userRoomCreationMessageIds.has(telegramId)) {
      const messageId = userRoomCreationMessageIds.get(telegramId)!;
      const chatId = ctx.chat?.id || ctx.from?.id || telegramId;
      await ctx.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
    }
    // Otherwise, send a new message (text input context)
    else {
      const sentMessage = await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      userRoomCreationMessageIds.set(telegramId, sentMessage.message_id);
    }
  } catch (error: any) {
    // If edit fails, send as new message
    try {
      const sentMessage = await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      userRoomCreationMessageIds.set(telegramId, sentMessage.message_id);
    } catch (replyError: any) {
      console.error('Failed to update room creation message:', replyError);
    }
  }
}

