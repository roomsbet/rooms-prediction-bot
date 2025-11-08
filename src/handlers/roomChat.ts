/**
 * Room Chat Commands - Interactive commands for room participants
 * 
 * Access Control:
 * - Commands only available to users with ACTIVE bets in the room
 * - Non-participants receive "Join the room to use commands" message
 * 
 * Rate Limiting:
 * - 5-second cooldown per user per command
 * - In-memory map: ${roomId}:${tgId}:${cmd}
 * - Prevents spam and abuse
 * 
 * Commands:
 * /watch - Live room summary (compact)
 * /bet <amount> <YES|NO> - Place bet from chat
 * /players - List participants by side
 * /oracle - Current oracle price
 * /stats - Full market info
 * /help - Command list
 * /taunt - Random taunt message
 */

import { Context } from 'telegraf';
import {
  isParticipant,
  roomFromChat,
  poolBreakdown,
  getOraclePrice,
  placeBetFromChat,
  getParticipantsList,
  getRoomStats,
  getRandomTaunt,
} from '../domain/roomChat';

// Rate limiting map: key = `${roomId}:${tgId}:${cmd}`, value = timestamp
const rateLimitMap = new Map<string, number>();
const COOLDOWN_MS = 5000;

/**
 * Check if command is rate limited
 */
function checkRateLimit(roomId: string, tgId: number, cmd: string): boolean {
  const key = `${roomId}:${tgId}:${cmd}`;
  const now = Date.now();
  const lastUsed = rateLimitMap.get(key);

  if (lastUsed && now - lastUsed < COOLDOWN_MS) {
    return false; // Rate limited
  }

  rateLimitMap.set(key, now);
  return true; // Allowed
}

/**
 * Format time left as mm:ss
 */
function formatTimeLeft(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format settle time as readable time
 */
function formatSettleTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * /watch command - Compact live summary
 */
export async function handleWatchCommand(ctx: Context) {
  try {
    const chatId = ctx.chat?.id?.toString();
    const tgId = ctx.from?.id;

    if (!chatId || !tgId) {
      return;
    }

    // Get room from chat ID
    const room = await roomFromChat(chatId);
    if (!room) {
      return; // Not a room chat, ignore
    }

    // Check if user is participant
    const participant = await isParticipant(tgId, room.id);
    if (!participant) {
      await ctx.reply('Join the room to use commands.');
      return;
    }

    // Check rate limit
    if (!checkRateLimit(room.id, tgId, 'watch')) {
      return; // Silently ignore rate limited requests
    }

    const breakdown = await poolBreakdown(room.id);
    if (!breakdown) {
      return;
    }

    const now = new Date();
    const timeToSettle = Math.max(0, Math.floor((room.settleTime.getTime() - now.getTime()) / 1000));

    const message =
      `🏛️ *${room.title}*\n\n` +
      `👥 ${room.currentPlayers}/${room.cap} | 💰 ${breakdown.total.toFixed(2)} SOL\n` +
      `✅ YES ${breakdown.yes.toFixed(2)} (${breakdown.yesPercent}%) | ❌ NO ${breakdown.no.toFixed(2)} (${breakdown.noPercent}%)\n` +
      `🕐 Settles in ${formatTimeLeft(timeToSettle)}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in /watch command:', error);
  }
}

/**
 * /bet command - Place bet from chat
 */
export async function handleBetCommand(ctx: Context) {
  try {
    const chatId = ctx.chat?.id?.toString();
    const tgId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || 'user';

    if (!chatId || !tgId) {
      return;
    }

    // Get room from chat ID
    const room = await roomFromChat(chatId);
    if (!room) {
      return; // Not a room chat, ignore
    }

    // Check if user is participant
    const participant = await isParticipant(tgId, room.id);
    if (!participant) {
      await ctx.reply('Join the room to use commands.');
      return;
    }

    // Check rate limit
    if (!checkRateLimit(room.id, tgId, 'bet')) {
      await ctx.reply('⏳ Please wait a moment before betting again.');
      return;
    }

    // Parse command: /bet 0.2 YES
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }
    
    const parts = ctx.message.text.split(' ').filter((p: string) => p);
    if (parts.length !== 3) {
      await ctx.reply('Usage: `/bet <amount> <YES|NO>`\nExample: `/bet 0.2 YES`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const amount = parseFloat(parts[1]);
    const side = parts[2].toUpperCase();

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Invalid amount. Use a positive number.');
      return;
    }

    if (side !== 'YES' && side !== 'NO') {
      await ctx.reply('❌ Invalid side. Use YES or NO.');
      return;
    }

    // Validate bet limits
    const minBet = room.minBet.toNumber();
    const maxBet = room.maxBet?.toNumber();

    if (amount < minBet) {
      await ctx.reply(`❌ Minimum bet is ${minBet.toFixed(2)} SOL`);
      return;
    }

    if (maxBet && amount > maxBet) {
      await ctx.reply(`❌ Maximum bet is ${maxBet.toFixed(2)} SOL`);
      return;
    }

    // Place bet
    try {
      await placeBetFromChat(tgId, room.id, amount, side as 'YES' | 'NO');

      // Get updated room stats
      const updatedRoom = await roomFromChat(chatId);
      const breakdown = await poolBreakdown(room.id);

      const message =
        `✅ @${username} bet ${amount.toFixed(2)} SOL on ${side} ` +
        `(${updatedRoom?.currentPlayers || room.currentPlayers}/${room.cap} • Pool ${breakdown?.total.toFixed(2) || '0.00'} SOL)`;

      await ctx.reply(message);
    } catch (error: any) {
      await ctx.reply(`❌ ${error.message || 'Failed to place bet'}`);
    }
  } catch (error) {
    console.error('Error in /bet command:', error);
  }
}

/**
 * /players command - List participants by side
 */
export async function handlePlayersCommand(ctx: Context) {
  try {
    const chatId = ctx.chat?.id?.toString();
    const tgId = ctx.from?.id;

    if (!chatId || !tgId) {
      return;
    }

    // Get room from chat ID
    const room = await roomFromChat(chatId);
    if (!room) {
      return; // Not a room chat, ignore
    }

    // Check if user is participant
    const participant = await isParticipant(tgId, room.id);
    if (!participant) {
      await ctx.reply('Join the room to use commands.');
      return;
    }

    // Check rate limit
    if (!checkRateLimit(room.id, tgId, 'players')) {
      return; // Silently ignore
    }

    const participants = await getParticipantsList(room.id);

    let message = '';

    if (participants.yes.length > 0) {
      const yesList = participants.yes
        .map(p => `@${p.username}(${p.amount.toFixed(2)})`)
        .join(', ');
      message += `YES: ${yesList}\n`;
    } else {
      message += `YES: (none)\n`;
    }

    if (participants.no.length > 0) {
      const noList = participants.no
        .map(p => `@${p.username}(${p.amount.toFixed(2)})`)
        .join(', ');
      message += `NO:  ${noList}`;
    } else {
      message += `NO:  (none)`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error in /players command:', error);
  }
}

/**
 * /oracle command - Show current oracle price
 */
export async function handleOracleCommand(ctx: Context) {
  try {
    const chatId = ctx.chat?.id?.toString();
    const tgId = ctx.from?.id;

    if (!chatId || !tgId) {
      return;
    }

    // Get room from chat ID
    const room = await roomFromChat(chatId);
    if (!room) {
      return; // Not a room chat, ignore
    }

    // Check if user is participant
    const participant = await isParticipant(tgId, room.id);
    if (!participant) {
      await ctx.reply('Join the room to use commands.');
      return;
    }

    // Check rate limit
    if (!checkRateLimit(room.id, tgId, 'oracle')) {
      return; // Silently ignore
    }

    const price = await getOraclePrice(room.oracleFeed);
    const message = `🔎 Oracle (${room.oracleFeed}): ${price.toFixed(2)}`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Error in /oracle command:', error);
  }
}

/**
 * /stats command - Full market info
 */
export async function handleStatsCommand(ctx: Context) {
  try {
    const chatId = ctx.chat?.id?.toString();
    const tgId = ctx.from?.id;

    if (!chatId || !tgId) {
      return;
    }

    // Get room from chat ID
    const room = await roomFromChat(chatId);
    if (!room) {
      return; // Not a room chat, ignore
    }

    // Check if user is participant
    const participant = await isParticipant(tgId, room.id);
    if (!participant) {
      await ctx.reply('Join the room to use commands.');
      return;
    }

    // Check rate limit
    if (!checkRateLimit(room.id, tgId, 'stats')) {
      return; // Silently ignore
    }

    const stats = await getRoomStats(room.id);
    if (!stats) {
      return;
    }

    const maxBetText = stats.maxBet ? ` • Max: ${stats.maxBet.toFixed(2)} SOL` : '';
    const message =
      `Feed: ${stats.oracleFeed} | Cap: ${stats.cap} players\n` +
      `Min: ${stats.minBet.toFixed(2)} SOL${maxBetText}\n` +
      `Pool: ${stats.pool.toFixed(2)} SOL (YES ${stats.yesPercent}% / NO ${stats.noPercent}%)\n` +
      `Settles at: ${formatSettleTime(stats.settleTime)}`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Error in /stats command:', error);
  }
}

/**
 * /help command - List all commands
 */
export async function handleHelpCommand(ctx: Context) {
  try {
    const chatId = ctx.chat?.id?.toString();
    const tgId = ctx.from?.id;

    if (!chatId || !tgId) {
      return;
    }

    // Get room from chat ID
    const room = await roomFromChat(chatId);
    if (!room) {
      return; // Not a room chat, ignore
    }

    // Check if user is participant
    const participant = await isParticipant(tgId, room.id);
    if (!participant) {
      await ctx.reply('Join the room to use commands.');
      return;
    }

    // Check rate limit
    if (!checkRateLimit(room.id, tgId, 'help')) {
      return; // Silently ignore
    }

    const message =
      `*Room Chat Commands:*\n\n` +
      `/watch - Live room summary\n` +
      `/bet <amount> <YES|NO> - Place bet\n` +
      `/players - List participants\n` +
      `/oracle - Current oracle price\n` +
      `/stats - Full market info\n` +
      `/taunt - Random taunt\n` +
      `/help - Show this help`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in /help command:', error);
  }
}

/**
 * /taunt command - Random taunt message
 */
export async function handleTauntCommand(ctx: Context) {
  try {
    const chatId = ctx.chat?.id?.toString();
    const tgId = ctx.from?.id;

    if (!chatId || !tgId) {
      return;
    }

    // Get room from chat ID
    const room = await roomFromChat(chatId);
    if (!room) {
      return; // Not a room chat, ignore
    }

    // Check if user is participant
    const participant = await isParticipant(tgId, room.id);
    if (!participant) {
      await ctx.reply('Join the room to use commands.');
      return;
    }

    // Check rate limit
    if (!checkRateLimit(room.id, tgId, 'taunt')) {
      return; // Silently ignore
    }

    const taunt = getRandomTaunt();
    await ctx.reply(taunt);
  } catch (error) {
    console.error('Error in /taunt command:', error);
  }
}

