/**
 * Wallet Keyboard - Wallet management inline keyboards
 */

import { InlineKeyboardMarkup } from 'telegraf/types';

export function getWalletKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '💰 Deposit', callback_data: 'cb:deposit' },
        { text: '💸 Withdraw', callback_data: 'cb:withdraw' }
      ],
      [
        { text: '🔑 Private Keys', callback_data: 'cb:show_private_key' },
        { text: '📊 Transfers', callback_data: 'cb:wallet_history' }
      ],
      [
        { text: '⬅️ Back', callback_data: 'cb:back_dashboard' }
      ],
      [
        { text: '× Dismiss', callback_data: 'cb:dismiss' }
      ]
    ]
  };
}

export function getDepositKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ I\'ve Sent SOL', callback_data: 'cb:deposit_confirm' }
      ],
      [
        { text: '⬅️ Back to Wallet', callback_data: 'cb:wallet' }
      ],
      [
        { text: '× Dismiss', callback_data: 'cb:dismiss' }
      ]
    ]
  };
}

export function getWithdrawKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '💸 Set Address', callback_data: 'cb:withdraw_set_address' }
      ],
      [
        { text: '⬅️ Back to Wallet', callback_data: 'cb:wallet' }
      ],
      [
        { text: '× Dismiss', callback_data: 'cb:dismiss' }
      ]
    ]
  };
}

export function getWithdrawAmountKeyboard(balance: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '💯 Withdraw 100%', callback_data: `cb:withdraw_100:${balance}` }
      ],
      [
        { text: '⬅️ Back to Wallet', callback_data: 'cb:wallet' }
      ],
      [
        { text: '× Dismiss', callback_data: 'cb:dismiss' }
      ]
    ]
  };
}

export function getHistoryKeyboard(page: number, hasMore: boolean): InlineKeyboardMarkup {
  const buttons: any[][] = [];
  
  // Pagination
  const navRow: any[] = [];
  if (page > 0) {
    navRow.push({ text: '⬅️ Previous', callback_data: `cb:wallet_history:${page - 1}` });
  }
  if (hasMore) {
    navRow.push({ text: 'Next ➡️', callback_data: `cb:wallet_history:${page + 1}` });
  }
  
  if (navRow.length > 0) {
    buttons.push(navRow);
  }
  
  buttons.push([
    { text: '⬅️ Back to Wallet', callback_data: 'cb:wallet' }
  ]);
  
  buttons.push([
    { text: '× Dismiss', callback_data: 'cb:dismiss' }
  ]);
  
  return { inline_keyboard: buttons };
}

