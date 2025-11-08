/**
 * Dashboard Messages - Message templates for the main dashboard
 */

import { shortAddress } from '../infra/solana';
import { formatUsd } from '../infra/price';

export interface DashboardData {
  walletAddress: string;
  balance: number;
  usdValue: number;
  activeRooms: number;
  pnl24h: number;
  roomsWon24h: number;
  winRate: number;
}

export function formatDashboardMessage(data: DashboardData): string {
  const pnlSign = data.pnl24h >= 0 ? '+' : '';
  const pnlEmoji = data.pnl24h >= 0 ? '📈' : '📉';
  
  return `🏛️ *ROOMS*
_Settle bets behind closed doors._

*Wallet:* \`${data.walletAddress}\`
*Balance:* ${data.balance.toFixed(4)} SOL (${formatUsd(data.usdValue)})

*Stats:*
Active Rooms: ${data.activeRooms} | 24h PnL: ${pnlEmoji} ${pnlSign}${data.pnl24h.toFixed(4)} SOL
Recent Wins: ${data.roomsWon24h} | Win Rate: ${data.winRate.toFixed(1)}%

━━━━━━━━━━━━━━━━━━

📚 *Resources:*
• [Guide to ROOMS](https://docs.rooms.gg)
• [Twitter / X](https://x.com/rooms)
• [Website](https://rooms.gg)`;
}

export function formatWelcomeMessage(): string {
  return `🏛️ *Welcome to ROOMS!*

Your wallet has been created securely. You can now deposit SOL and start betting on prediction markets!

🔐 *Security:* Your private key is encrypted and stored securely. Never share your wallet details with anyone.

👉 Use /start to access your dashboard anytime.`;
}

