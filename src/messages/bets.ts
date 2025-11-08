/**
 * Bets Messages - Message templates for bet history and active bets
 */

export interface BetItem {
  id: string;
  roomTitle: string;
  side: string;
  amount: number;
  settled: boolean;
  won?: boolean;
  payout?: number;
  createdAt: Date;
}

export function formatMyBetsMessage(activeBets: number, totalBets: number): string {
  return `🧾 *My Bets*

*Active Bets:* ${activeBets}
*Total Bets Placed:* ${totalBets}

_Select an option below to view your bets_`;
}

export function formatActiveBetsMessage(bets: BetItem[]): string {
  if (bets.length === 0) {
    return `🟢 *Active Bets*

No active bets at the moment.

_Join a room to start betting!_`;
  }

  let message = `🟢 *Active Bets*\n\n`;
  
  bets.forEach((bet, index) => {
    const sideEmoji = bet.side === 'YES' ? '✅' : '❌';
    message += `${index + 1}. ${sideEmoji} *${bet.roomTitle}*\n`;
    message += `   Bet: ${bet.side} | Amount: ${bet.amount.toFixed(4)} SOL\n`;
    message += `   _Placed: ${bet.createdAt.toLocaleString()}_\n\n`;
  });
  
  return message;
}

export function formatBetHistoryMessage(bets: BetItem[], page: number): string {
  if (bets.length === 0) {
    return `📜 *Bet History*

No bet history yet.

_Your completed bets will appear here_`;
  }

  let message = `📜 *Bet History* (Page ${page + 1})\n\n`;
  
  bets.forEach((bet, index) => {
    const sideEmoji = bet.side === 'YES' ? '✅' : '❌';
    const resultEmoji = bet.won ? '🏆' : '❌';
    
    message += `${index + 1}. ${resultEmoji} ${sideEmoji} *${bet.roomTitle}*\n`;
    message += `   Bet: ${bet.side} | Amount: ${bet.amount.toFixed(4)} SOL\n`;
    
    if (bet.won && bet.payout) {
      const profit = bet.payout - bet.amount;
      message += `   Payout: ${bet.payout.toFixed(4)} SOL (+${profit.toFixed(4)})\n`;
    } else {
      message += `   Lost: ${bet.amount.toFixed(4)} SOL\n`;
    }
    
    message += `   _${bet.createdAt.toLocaleString()}_\n\n`;
  });
  
  return message;
}

export function formatRoomsWonMessage(wonRooms: BetItem[]): string {
  if (wonRooms.length === 0) {
    return `🏆 *Rooms Won*

No wins yet.

_Keep betting to get your first win!_`;
  }

  let totalProfit = 0;
  let totalAmount = 0;
  let message = `🏆 *Rooms Won*\n\n`;
  
  wonRooms.slice(0, 10).forEach((bet, index) => {
    const sideEmoji = bet.side === 'YES' ? '✅' : '❌';
    const profit = bet.payout! - bet.amount;
    totalProfit += profit;
    totalAmount += bet.payout!;
    
    message += `${index + 1}. 🏆 ${sideEmoji} *${bet.roomTitle}*\n`;
    message += `   Profit: +${profit.toFixed(4)} SOL | Total: ${bet.payout!.toFixed(4)} SOL\n\n`;
  });
  
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `*Total Profit:* +${totalProfit.toFixed(4)} SOL\n`;
  message += `*Total Winnings:* ${totalAmount.toFixed(4)} SOL`;
  
  return message;
}

