/**
 * Dashboard Keyboard - Main menu inline keyboard
 */

import { InlineKeyboardMarkup } from 'telegraf/types';

export function getDashboardKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      // Wide button: Enter Rooms
      [
        { text: '🟢 Enter Rooms', callback_data: 'cb:enter_rooms' }
      ],
      // 2-column grid
      [
        { text: '💼 Wallet', callback_data: 'cb:wallet' },
        { text: '🧾 My Bets', callback_data: 'cb:my_bets' }
      ],
      [
        { text: '👥 Referrals', callback_data: 'cb:referrals' },
        { text: '🏆 Rooms Won', callback_data: 'won:list:p=1' }
      ],
      [
        { text: '🕓 Recent Rooms', callback_data: 'cb:recent_rooms' },
        { text: '📜 Rules', callback_data: 'cb:rules' }
      ],
      [
        { text: '🗑 Close', callback_data: 'cb:dismiss' },
        { text: '🔄 Refresh', callback_data: 'cb:refresh' }
      ]
    ]
  };
}

