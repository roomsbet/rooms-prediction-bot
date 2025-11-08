/**
 * User Room Creation Keyboards
 */

import { InlineKeyboardMarkup } from 'telegraf/types';
import { UserRoomDraft } from '../messages/userRoomCreation';

export function getUserRoomKeyboard(draft: UserRoomDraft): InlineKeyboardMarkup {
  const allSet = draft.title && draft.marketType && draft.targetValue && draft.settleTimeMinutes &&
    (draft.marketType === 'coin_price' ? (draft.coinSymbol && draft.coinTrackType) : (draft.marketType === 'pumpfun_mcap' && draft.tokenAddress));

  const buttons: any[][] = [
    [{ text: '📝 Set Title', callback_data: 'user:set_title' }],
    [{ text: '📊 Set Market Type', callback_data: 'user:set_market' }],
    [{ text: '🎯 Set Target', callback_data: 'user:set_target' }],
    [{ text: '⏱️ Set Settle Time', callback_data: 'user:set_time' }],
  ];

  if (allSet) {
    buttons.push([{ text: '✅ Deploy Room', callback_data: 'user:deploy' }]);
  }

  buttons.push([
    { text: '⬅️ Back to Dashboard', callback_data: 'cb:back_dashboard' },
    { text: '❌ Cancel', callback_data: 'cb:back_dashboard' }
  ]);

  return { inline_keyboard: buttons };
}

export function getUserMarketTypeKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '💰 Coin Price', callback_data: 'user:market:coin_price' }],
      [{ text: '🚀 Pump.fun Token', callback_data: 'user:market:pumpfun_mcap' }],
      [{ text: '📝 Custom Oracle (Soon)', callback_data: 'user:custom_soon' }],
      [{ text: '⬅️ Back', callback_data: 'user:create_start' }]
    ]
  };
}

export function getSettleTimeKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '15 minutes', callback_data: 'user:time:15' },
        { text: '30 minutes', callback_data: 'user:time:30' }
      ],
      [
        { text: '1 hour', callback_data: 'user:time:60' },
        { text: '2 hours', callback_data: 'user:time:120' }
      ],
      [
        { text: '4 hours', callback_data: 'user:time:240' },
        { text: '24 hours', callback_data: 'user:time:1440' }
      ],
      [{ text: '⏱️ Custom Time', callback_data: 'user:time:custom' }],
      [{ text: '⬅️ Back', callback_data: 'user:create_start' }]
    ]
  };
}

