/**
 * Referrals Keyboard - Referral system inline keyboards
 */

import { InlineKeyboardMarkup } from 'telegraf/types';

export function getReferralsKeyboard(referralCode: string, botUsername: string): InlineKeyboardMarkup {
  const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;
  
  return {
    inline_keyboard: [
      [
        { 
          text: '📤 Share Referral Link', 
          url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join ROOMS and start winning!`
        }
      ],
      [
        { text: '⬅️ Back to Dashboard', callback_data: 'cb:back_dashboard' },
        { text: '🔄 Refresh Stats', callback_data: 'cb:referrals' }
      ],
      [
        { text: '× Dismiss', callback_data: 'cb:dismiss' }
      ]
    ]
  };
}

