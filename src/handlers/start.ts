/**
 * Start Handler - /start command and dashboard display
 */

import { Context } from 'telegraf';
import { getOrCreateUser, getBalance } from '../domain/wallet';
import { formatDashboardMessage, formatWelcomeMessage } from '../messages/dashboard';
import { getDashboardKeyboard } from '../keyboards/dashboard';
import { getSolPrice, formatUsd } from '../infra/price';
import { prisma } from '../infra/db';
import { decryptKey } from '../infra/kms';
import bs58 from 'bs58';

export async function handleStart(ctx: Context): Promise<void> {
  try {
    console.log('📥 /start command received');
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username;

    if (!telegramId) {
      console.error('❌ No telegramId found');
      await ctx.reply('Error: Could not identify user');
      return;
    }

    console.log(`👤 User: ${telegramId} (@${username || 'no-username'})`);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    console.log(`📊 User exists: ${!!existingUser}`);

    // Get or create user
    const user = await getOrCreateUser(telegramId, username);
    const isNewUser = !existingUser;

    if (isNewUser) {
      console.log('🆕 New user - showing private key');
      // Show private key for new users ONCE
      await showPrivateKeyOnce(ctx, user);
    } else {
      console.log('👋 Returning user - showing dashboard');
      // Show dashboard for returning users
      await showDashboard(ctx, telegramId);
    }
  } catch (error) {
    console.error('❌ Error in handleStart:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    try {
      await ctx.reply('❌ An error occurred. Please try again later.');
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Show private key to new user (only once)
 */
async function showPrivateKeyOnce(ctx: Context, user: any) {
  try {
    // Decrypt and encode private key
    const secretKey = await decryptKey(user.encryptedKey);
    const privateKeyBase58 = bs58.encode(secretKey);

    const message = 
      '🔐 *YOUR WALLET HAS BEEN CREATED*\n\n' +
      '*Your Private Key (Save as Backup):*\n' +
      `\`${privateKeyBase58}\`\n\n` +
      '⚠️ *IMPORTANT:*\n' +
      '• This is shown ONCE only\n' +
      '• Save it somewhere safe\n' +
      '• You can import this into any Solana wallet (Phantom, Solflare, etc)\n\n' +
      '🔴 *Screenshot this now - you won\'t see it again!*';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ I SAVED MY KEY - CONTINUE', callback_data: 'cb:key_saved' }
        ]]
      }
    });
  } catch (error) {
    console.error('Error showing private key:', error);
    await ctx.reply('❌ Error displaying private key. Please contact support.');
  }
}

export async function showDashboard(ctx: Context, telegramId: number): Promise<void> {
  try {
    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!user) {
      await ctx.reply('❌ User not found. Use /start to initialize.');
      return;
    }

    // Get SOL price (with fallback if it fails)
    let solPrice = 150; // Default fallback
    try {
      solPrice = await getSolPrice();
    } catch (error) {
      console.error('Failed to get SOL price, using fallback:', error);
    }
    const balance = user.balance.toNumber();
    const usdValue = balance * solPrice;

    // Get active rooms count
    const activeRooms = await prisma.room.count({
      where: { status: 'OPEN' },
    });

    // Get 24h stats
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const bets24h = await prisma.bet.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: yesterday },
        settled: true,
      },
    });

    let pnl24h = 0;
    let wins24h = 0;
    let totalBets24h = bets24h.length;

    bets24h.forEach(bet => {
      const betAmount = bet.amount.toNumber();
      const payout = bet.payout.toNumber();
      
      if (bet.won) {
        wins24h++;
        pnl24h += payout - betAmount;
      } else {
        pnl24h -= betAmount;
      }
    });

    const winRate = totalBets24h > 0 ? (wins24h / totalBets24h) * 100 : 0;

    // Format dashboard message
    const message = formatDashboardMessage({
      walletAddress: user.walletAddress,
      balance,
      usdValue,
      activeRooms,
      pnl24h,
      roomsWon24h: wins24h,
      winRate,
    });

    const keyboard = getDashboardKeyboard();

    // Edit message if from callback, otherwise send new
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        await ctx.answerCbQuery();
      } catch (editError: any) {
        // If message hasn't changed, just acknowledge silently
        if (editError.description?.includes('message is not modified')) {
          await ctx.answerCbQuery();
        } else {
          throw editError; // Re-throw other errors
        }
      }
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error('Error in showDashboard:', error);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Error loading dashboard');
    } else {
      await ctx.reply('❌ Error loading dashboard. Please try again.');
    }
  }
}

