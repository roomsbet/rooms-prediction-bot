/**
 * Wallet Handler - Wallet operations
 */

import { Context } from 'telegraf';
import { prisma } from '../infra/db';
import { getSolPrice } from '../infra/price';
import { getTransactionHistory } from '../domain/wallet';
import {
  formatWalletMessage,
  formatDepositMessage,
  formatWithdrawMessage,
  formatWithdrawAmountMessage,
  formatTransactionHistory,
} from '../messages/wallet';
import {
  getWalletKeyboard,
  getDepositKeyboard,
  getHistoryKeyboard,
  getWithdrawKeyboard,
  getWithdrawAmountKeyboard,
} from '../keyboards/wallet';
import { setUserState, getUserState, clearUserState } from '../utils/conversationState';

export async function handleWallet(ctx: Context) {
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

    const solPrice = await getSolPrice();
    const balance = user.balance.toNumber();

    // Calculate available for bets (balance minus active bets)
    const activeBets = await prisma.bet.aggregate({
      where: {
        userId: user.id,
        settled: false,
      },
      _sum: {
        amount: true,
      },
    });

    const lockedInBets = activeBets._sum.amount?.toNumber() || 0;
    const availableForBets = balance; // In our model, balance is already after bets are placed

    const message = formatWalletMessage({
      address: user.walletAddress,
      balance,
      usdValue: balance * solPrice,
      totalDeposited: user.totalDeposited.toNumber(),
      totalWithdrawn: user.totalWithdrawn.toNumber(),
      availableForBets,
    });

    const keyboard = getWalletKeyboard();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleWallet:', error);
    await ctx.answerCbQuery('❌ Error loading wallet');
  }
}

export async function handleDeposit(ctx: Context) {
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

    const message = formatDepositMessage(user.walletAddress);
    const keyboard = getDepositKeyboard();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleDeposit:', error);
    await ctx.answerCbQuery('❌ Error loading deposit info');
  }
}

export async function handleWithdraw(ctx: Context) {
  try {
    const message = formatWithdrawMessage();
    const keyboard = getWithdrawKeyboard();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleWithdraw:', error);
    await ctx.answerCbQuery('❌ Error loading withdrawal form');
  }
}

export async function handleWithdrawSetAddress(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Set conversation state
    setUserState(telegramId, 'withdraw_address');

    await ctx.answerCbQuery('📝 Send your withdrawal address');
    await ctx.reply('📝 Please send your Solana wallet address:', {
      reply_markup: { force_reply: true },
    });
  } catch (error) {
    console.error('Error in handleWithdrawSetAddress:', error);
    await ctx.answerCbQuery('❌ Error');
  }
}

export async function handleWithdrawAmount(ctx: Context, destinationAddress: string) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!user) {
      await ctx.reply('❌ User not found');
      return;
    }

    const balance = user.balance.toNumber();
    
    // Set conversation state with address
    setUserState(telegramId, 'withdraw_amount', { address: destinationAddress });

    const message = formatWithdrawAmountMessage(balance, destinationAddress);
    const keyboard = getWithdrawAmountKeyboard(balance);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Error in handleWithdrawAmount:', error);
    await ctx.reply('❌ Error processing withdrawal');
  }
}

export async function handleWithdraw100(ctx: Context, balance: number) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const state = getUserState(telegramId);
    if (!state || !state.data?.address) {
      await ctx.answerCbQuery('❌ Error: Address not set');
      return;
    }

    await processWithdrawal(ctx, telegramId, state.data.address, balance);
  } catch (error) {
    console.error('Error in handleWithdraw100:', error);
    await ctx.answerCbQuery('❌ Error processing withdrawal');
  }
}

async function processWithdrawal(ctx: Context, telegramId: number, address: string, amount: number) {
  try {
    const { withdraw } = await import('../domain/wallet');
    
    await withdraw(telegramId, address, amount);
    
    clearUserState(telegramId);
    
    await ctx.answerCbQuery('✅ Withdrawal initiated!');
    await ctx.reply(`✅ *Withdrawal Successful!*\n\n*Amount:* ${amount.toFixed(4)} SOL\n*To:* \`${address}\`\n\nFunds will arrive shortly.`, {
      parse_mode: 'Markdown',
    });
  } catch (error: any) {
    clearUserState(telegramId);
    await ctx.answerCbQuery(`❌ ${error.message || 'Withdrawal failed'}`);
  }
}

export async function handleWalletHistory(ctx: Context, page: number = 0) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const transactions = await getTransactionHistory(telegramId, page, 10);
    const hasMore = transactions.length === 10;

    const message = formatTransactionHistory(transactions, page);
    const keyboard = getHistoryKeyboard(page, hasMore);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleWalletHistory:', error);
    await ctx.answerCbQuery('❌ Error loading transaction history');
  }
}

export async function handleShowPrivateKey(ctx: Context) {
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

    // Decrypt the private key
    const { decryptKey } = await import('../infra/kms');
    const secretKey = await decryptKey(user.encryptedKey);
    const privateKeyBase58 = Buffer.from(secretKey).toString('base64');

    const message = `🔑 *Private Key*

⚠️ *NEVER SHARE THIS WITH ANYONE!*

*Wallet Address:*
\`${user.walletAddress}\`

*Private Key (Base64):*
\`${privateKeyBase58}\`

⚠️ *WARNING:*
• Anyone with this key can steal your funds
• Delete this message after copying
• Store securely offline
• ROOMS will never ask for this`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ Back to Wallet', callback_data: 'cb:wallet' }]
        ]
      },
    });
    await ctx.answerCbQuery('⚠️ Private key displayed - be careful!');
  } catch (error) {
    console.error('Error in handleShowPrivateKey:', error);
    await ctx.answerCbQuery('❌ Error loading private key');
  }
}

