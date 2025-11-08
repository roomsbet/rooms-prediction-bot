/**
 * Bets Handler - Bet tracking and history
 */

import { Context } from 'telegraf';
import { prisma } from '../infra/db';
import {
  formatMyBetsMessage,
  formatActiveBetsMessage,
  formatBetHistoryMessage,
  formatRoomsWonMessage,
} from '../messages/bets';
import {
  getBetsKeyboard,
  getActiveBetsKeyboard,
  getBetHistoryKeyboard,
} from '../keyboards/bets';

export async function handleMyBets(ctx: Context) {
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

    const activeBets = await prisma.bet.count({
      where: {
        userId: user.id,
        settled: false,
      },
    });

    const totalBets = await prisma.bet.count({
      where: { userId: user.id },
    });

    const message = formatMyBetsMessage(activeBets, totalBets);
    const keyboard = getBetsKeyboard(activeBets > 0);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleMyBets:', error);
    await ctx.answerCbQuery('❌ Error loading bets');
  }
}

export async function handleActiveBets(ctx: Context) {
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

    const bets = await prisma.bet.findMany({
      where: {
        userId: user.id,
        settled: false,
      },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });

    const formattedBets = bets.map(bet => ({
      id: bet.id,
      roomTitle: bet.room.title,
      side: bet.side,
      amount: bet.amount.toNumber(),
      settled: bet.settled,
      won: bet.won || undefined,
      payout: bet.payout.toNumber(),
      createdAt: bet.createdAt,
    }));

    const message = formatActiveBetsMessage(formattedBets);
    const keyboard = getActiveBetsKeyboard();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleActiveBets:', error);
    await ctx.answerCbQuery('❌ Error loading active bets');
  }
}

export async function handleBetHistory(ctx: Context, page: number = 0) {
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

    const bets = await prisma.bet.findMany({
      where: {
        userId: user.id,
        settled: true,
      },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
      skip: page * 10,
      take: 10,
    });

    const formattedBets = bets.map(bet => ({
      id: bet.id,
      roomTitle: bet.room.title,
      side: bet.side,
      amount: bet.amount.toNumber(),
      settled: bet.settled,
      won: bet.won || undefined,
      payout: bet.payout.toNumber(),
      createdAt: bet.createdAt,
    }));

    const hasMore = bets.length === 10;

    const message = formatBetHistoryMessage(formattedBets, page);
    const keyboard = getBetHistoryKeyboard(page, hasMore);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleBetHistory:', error);
    await ctx.answerCbQuery('❌ Error loading bet history');
  }
}

export async function handleRoomsWon(ctx: Context) {
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

    const wonBets = await prisma.bet.findMany({
      where: {
        userId: user.id,
        settled: true,
        won: true,
      },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });

    const formattedBets = wonBets.map(bet => ({
      id: bet.id,
      roomTitle: bet.room.title,
      side: bet.side,
      amount: bet.amount.toNumber(),
      settled: bet.settled,
      won: bet.won || undefined,
      payout: bet.payout.toNumber(),
      createdAt: bet.createdAt,
    }));

    const message = formatRoomsWonMessage(formattedBets);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Back to Dashboard', callback_data: 'cb:back_dashboard' }]],
      },
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleRoomsWon:', error);
    await ctx.answerCbQuery('❌ Error loading wins');
  }
}

