/**
 * Settlement Messages - Push notifications for room settlement results
 */

export interface SettlementNotification {
  roomTitle: string;
  winningSide: 'YES' | 'NO';
  userSide: 'YES' | 'NO';
  betAmount: number;
  payout: number;
  won: boolean;
}

/**
 * Format settlement notification message for participants
 */
export function formatSettlementNotification(data: SettlementNotification): string {
  const emoji = data.won ? '🎉' : '😔';
  const result = data.won ? 'WON' : 'LOST';
  
  let message = `${emoji} *Room Settled!*\n\n`;
  message += `*${data.roomTitle}*\n\n`;
  message += `Winner: *${data.winningSide}*\n`;
  message += `Your bet: ${data.userSide}\n`;
  message += `Result: *${result}*\n\n`;
  
  if (data.won) {
    const profit = data.payout - data.betAmount;
    message += `💰 *Payout:* ${data.payout.toFixed(4)} SOL\n`;
    message += `📈 *Profit:* +${profit.toFixed(4)} SOL\n`;
  } else {
    message += `📉 *Lost:* ${data.betAmount.toFixed(4)} SOL\n`;
  }
  
  return message;
}

