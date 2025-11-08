/**
 * Referrals Handler - Referral system
 */

import { Context } from 'telegraf';
import { getReferralStats } from '../domain/referral';
import { formatReferralsMessage, formatRulesMessage } from '../messages/referrals';
import { getReferralsKeyboard } from '../keyboards/referrals';

export async function handleReferrals(ctx: Context) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const stats = await getReferralStats(telegramId);

    // Get bot username for referral link
    const botInfo = await ctx.telegram.getMe();
    const botUsername = botInfo.username;
    const referralLink = `https://t.me/${botUsername}?start=${stats.referralCode}`;

    const message = formatReferralsMessage(stats, referralLink);
    const keyboard = getReferralsKeyboard(stats.referralCode, botUsername);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleReferrals:', error);
    await ctx.answerCbQuery('❌ Error loading referrals');
  }
}

export async function handleRules(ctx: Context) {
  try {
    const message = formatRulesMessage();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Back to Dashboard', callback_data: 'cb:back_dashboard' }]],
      },
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in handleRules:', error);
    await ctx.answerCbQuery('❌ Error loading rules');
  }
}

