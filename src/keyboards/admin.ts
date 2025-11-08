/**
 * Admin Keyboards - Admin dashboard inline keyboards
 */

import { InlineKeyboardMarkup } from 'telegraf/types';

export function getAdminDashboardKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '➕ Create Room', callback_data: 'admin:create_room' }
      ],
      [
        { text: '📋 Active Rooms', callback_data: 'admin:list_rooms' },
        { text: '📊 Stats', callback_data: 'admin:stats' }
      ],
      [
        { text: '⚖️ Resolve Markets', callback_data: 'admin:resolve_markets' }
      ],
      [
        { text: '⚡ Force Settle', callback_data: 'admin:force_settle' }
      ],
      [
        { text: '👥 User Management', callback_data: 'admin:users' }
      ],
      [
        { text: '🔄 Refresh', callback_data: 'admin:refresh' }
      ]
    ]
  };
}

export function getMarketResolutionKeyboard(roomId: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🤖 Auto Resolve', callback_data: `admin:auto_resolve:${roomId}` }
      ],
      [
        { text: '✅ Manual: YES Wins', callback_data: `admin:manual_resolve:${roomId}:YES` },
        { text: '❌ Manual: NO Wins', callback_data: `admin:manual_resolve:${roomId}:NO` }
      ],
      [
        { text: '⬅️ Back', callback_data: 'admin:resolve_markets' }
      ]
    ]
  };
}

export function getRoomCreationKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📝 Set Title', callback_data: 'admin:set_title' }
      ],
      [
        { text: '📊 Set Market Type', callback_data: 'admin:set_market_type' }
      ],
      [
        { text: '📅 Set Target Date', callback_data: 'admin:set_target_date' }
      ],
      [
        { text: '⏰ Set Lock Time', callback_data: 'admin:set_lock_time' }
      ],
      [
        { text: '⏱ Set Settle Time', callback_data: 'admin:set_settle_time' }
      ],
      [
        { text: '💰 Set Min/Max Bet', callback_data: 'admin:set_bet_limits' }
      ],
      [
        { text: '👥 Set Capacity', callback_data: 'admin:set_capacity' }
      ],
      [
        { text: '✅ Deploy Room', callback_data: 'admin:deploy_room' }
      ],
      [
        { text: '❌ Cancel', callback_data: 'admin:dashboard' }
      ]
    ]
  };
}

export function getMarketTypeKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '💰 SOL Price', callback_data: 'admin:market_type:sol_price' }
      ],
      [
        { text: '🚀 Pump.fun Coin Price', callback_data: 'admin:market_type:pumpfun_mcap' }
      ],
      [
        { text: '📝 Custom Market', callback_data: 'admin:market_type:custom' }
      ],
      [
        { text: '⬅️ Back', callback_data: 'admin:create_room' }
      ]
    ]
  };
}

export function getTimePresetKeyboard(type: 'lock' | 'settle'): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '⏰ 5 minutes', callback_data: `admin:time_${type}:5` },
        { text: '⏰ 15 minutes', callback_data: `admin:time_${type}:15` }
      ],
      [
        { text: '⏰ 30 minutes', callback_data: `admin:time_${type}:30` },
        { text: '⏰ 1 hour', callback_data: `admin:time_${type}:60` }
      ],
      [
        { text: '⏰ 2 hours', callback_data: `admin:time_${type}:120` },
        { text: '⏰ 4 hours', callback_data: `admin:time_${type}:240` }
      ],
      [
        { text: '✏️ Custom', callback_data: `admin:time_${type}:custom` }
      ],
      [
        { text: '⬅️ Back', callback_data: 'admin:create_room' }
      ]
    ]
  };
}

export function getCapacityKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '5 Players', callback_data: 'admin:capacity:5' },
        { text: '10 Players', callback_data: 'admin:capacity:10' }
      ],
      [
        { text: '20 Players', callback_data: 'admin:capacity:20' },
        { text: '50 Players', callback_data: 'admin:capacity:50' }
      ],
      [
        { text: '⬅️ Back', callback_data: 'admin:create_room' }
      ]
    ]
  };
}

