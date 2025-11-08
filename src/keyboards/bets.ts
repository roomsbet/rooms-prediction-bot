/**
 * Bets Keyboard - Bet history and active bets inline keyboards
 */

import { InlineKeyboardMarkup } from 'telegraf/types';

export function getBetsKeyboard(hasActive: boolean): InlineKeyboardMarkup {
  const buttons: any[][] = [];
  
  if (hasActive) {
    buttons.push([
      { text: '🟢 Active Bets', callback_data: 'cb:bets_active' },
      { text: '📜 History', callback_data: 'cb:bets_history' }
    ]);
  } else {
    buttons.push([
      { text: '📜 Bet History', callback_data: 'cb:bets_history' }
    ]);
  }
  
  buttons.push([
    { text: '⬅️ Back to Dashboard', callback_data: 'cb:back_dashboard' }
  ]);
  
  buttons.push([
    { text: '× Dismiss', callback_data: 'cb:dismiss' }
  ]);
  
  return { inline_keyboard: buttons };
}

export function getBetHistoryKeyboard(page: number, hasMore: boolean): InlineKeyboardMarkup {
  const buttons: any[][] = [];
  
  // Pagination
  const navRow: any[] = [];
  if (page > 0) {
    navRow.push({ text: '⬅️ Previous', callback_data: `cb:bets_history:${page - 1}` });
  }
  if (hasMore) {
    navRow.push({ text: 'Next ➡️', callback_data: `cb:bets_history:${page + 1}` });
  }
  
  if (navRow.length > 0) {
    buttons.push(navRow);
  }
  
  buttons.push([
    { text: '⬅️ Back', callback_data: 'cb:my_bets' }
  ]);
  
  buttons.push([
    { text: '× Dismiss', callback_data: 'cb:dismiss' }
  ]);
  
  return { inline_keyboard: buttons };
}

export function getActiveBetsKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '⬅️ Back', callback_data: 'cb:my_bets' },
        { text: '🔄 Refresh', callback_data: 'cb:bets_active' }
      ]
    ]
  };
}

