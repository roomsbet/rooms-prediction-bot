/**
 * User Room Creation Messages
 */

export interface UserRoomDraft {
  title?: string;
  marketType?: 'coin_price' | 'pumpfun_mcap';
  targetValue?: number;
  settleTimeMinutes?: number;
  tokenAddress?: string;
  tokenSymbol?: string;
  coinSymbol?: string;
  coinName?: string;
  coinTrackType?: 'price' | 'market_cap'; // What to track for coin_price markets
}

export function formatUserRoomCreation(draft: UserRoomDraft): string {
  const formatTarget = () => {
    if (!draft.targetValue) return '❌ Not set';
    if (draft.marketType === 'coin_price') {
      const coinDisplay = draft.coinSymbol ? `${draft.coinSymbol} ` : '';
      const trackType = draft.coinTrackType === 'market_cap' ? 'Market Cap' : 'Price';
      const valueDisplay = draft.coinTrackType === 'market_cap'
        ? (draft.targetValue >= 1_000_000_000 ? `$${(draft.targetValue / 1_000_000_000).toFixed(2)}B` : `$${(draft.targetValue / 1_000_000).toFixed(2)}M`)
        : `$${draft.targetValue.toFixed(2)}`;
      return `${coinDisplay}${trackType} → ${valueDisplay}`;
    } else if (draft.marketType === 'pumpfun_mcap') {
      if (draft.targetValue >= 1_000_000) {
        return `$${(draft.targetValue / 1_000_000).toFixed(2)}M`;
      } else if (draft.targetValue >= 1_000) {
        return `$${(draft.targetValue / 1_000).toFixed(2)}K`;
      }
      return `$${draft.targetValue.toFixed(0)}`;
    }
    return '❌ Not set';
  };

  const formatTime = () => {
    if (!draft.settleTimeMinutes) return '❌ Not set';
    const hours = Math.floor(draft.settleTimeMinutes / 60);
    const minutes = draft.settleTimeMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim();
    }
    return `${minutes}m`;
  };

  let message = `➕ *Create New Room*\n\n`;
  message += `*Current Configuration:*\n\n`;
  message += `📝 Title: ${draft.title || '❌ Not set'}\n`;
  
  if (draft.marketType === 'coin_price') {
    const trackInfo = draft.coinTrackType ? ` - ${draft.coinTrackType === 'price' ? 'Price' : 'Market Cap'}` : '';
    message += `📊 Market: 💰 Coin${draft.coinSymbol ? ` (${draft.coinSymbol})` : ''}${trackInfo}\n`;
  } else if (draft.marketType === 'pumpfun_mcap') {
    message += `📊 Market: 🚀 Pump.fun Token\n`;
  } else {
    message += `📊 Market: ❌ Not set\n`;
  }
  
  message += `🎯 Target: ${formatTarget()}\n`;
  message += `⏱️ Settle Time: ${formatTime()}\n`;
  
  if (draft.marketType === 'pumpfun_mcap' && draft.tokenSymbol) {
    message += `🪙 Token: ${draft.tokenSymbol}\n`;
  }
  
  message += `\n━━━━━━━━━━━━━━━━━━\n\n`;
  
  const allSet = draft.title && draft.marketType && draft.targetValue && draft.settleTimeMinutes &&
    (draft.marketType === 'coin_price' ? (draft.coinSymbol && draft.coinTrackType) : (draft.marketType === 'pumpfun_mcap' && draft.tokenAddress));
  
  if (allSet) {
    message += `✅ *Ready to deploy!*`;
  } else {
    message += `⚠️ Complete all fields to deploy`;
  }
  
  return message;
}

