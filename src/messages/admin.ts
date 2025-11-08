/**
 * Admin Messages - Message templates for admin dashboard
 */

export interface AdminStats {
  totalUsers: number;
  activeRooms: number;
  totalRooms: number;
  totalVolume: number;
  usersToday: number;
}

export function formatAdminDashboard(stats: AdminStats): string {
  return `🔧 *ROOMS Admin Dashboard*

*Platform Stats:*
👥 Total Users: ${stats.totalUsers}
🆕 New Today: ${stats.usersToday}
🏛️ Active Rooms: ${stats.activeRooms}
📊 Total Rooms: ${stats.totalRooms}
💰 Total Volume: ${stats.totalVolume.toFixed(4)} SOL

━━━━━━━━━━━━━━━━━━

_Select an action below:_`;
}

export interface RoomDraft {
  title?: string;
  marketType?: 'sol_price' | 'pumpfun_mcap' | 'custom';
  oracleFeed?: string;
  targetValue?: number; // Target price or market cap
  targetDate?: Date;
  lockTimeMinutes?: number;
  settleTimeMinutes?: number;
  minBet?: number;
  maxBet?: number;
  capacity?: number;
  // For pump.fun coins
  tokenAddress?: string;
  tokenSymbol?: string;
}

export function formatRoomCreation(draft: RoomDraft): string {
  const title = draft.title || '❌ Not set';
  
  let marketInfo = '❌ Not set';
  if (draft.marketType === 'sol_price' && draft.targetValue) {
    marketInfo = `✅ SOL Price → $${draft.targetValue}`;
  } else if (draft.marketType === 'pumpfun_mcap' && draft.targetValue && draft.tokenSymbol && draft.tokenAddress) {
    marketInfo = `✅ ${draft.tokenSymbol} → $${draft.targetValue}\n   CA: \`${draft.tokenAddress.substring(0, 8)}...\``;
  } else if (draft.marketType === 'custom' && draft.oracleFeed) {
    marketInfo = `✅ ${draft.oracleFeed}`;
  } else if (draft.marketType) {
    marketInfo = `⚠️ ${draft.marketType} (incomplete)`;
  }
  
  const targetDate = draft.targetDate ? `✅ ${draft.targetDate.toLocaleString()}` : '❌ Not set';
  const lockTime = draft.lockTimeMinutes ? `✅ ${draft.lockTimeMinutes} minutes` : '❌ Not set';
  const settleTime = draft.settleTimeMinutes ? `✅ ${draft.settleTimeMinutes} minutes` : '❌ Not set';
  const minBet = draft.minBet ? `✅ ${draft.minBet} SOL` : '❌ Not set';
  const maxBet = draft.maxBet ? `✅ ${draft.maxBet} SOL` : '⚪ No limit';
  const capacity = draft.capacity ? `✅ ${draft.capacity} players` : '❌ Not set';

  const isComplete = draft.title && draft.marketType && 
                     (draft.targetValue || draft.oracleFeed) &&
                     draft.lockTimeMinutes && draft.settleTimeMinutes && 
                     draft.minBet && draft.capacity;

  return `➕ *Create New Room*

*Current Configuration:*

📝 Title: ${title}
📊 Market: ${marketInfo}
📅 Target Date: ${targetDate}
⏰ Lock Time: ${lockTime}
⏱ Settle Time: ${settleTime}
💰 Min Bet: ${minBet}
💰 Max Bet: ${maxBet}
👥 Capacity: ${capacity}

━━━━━━━━━━━━━━━━━━

${isComplete ? '✅ *Ready to deploy!*' : '⚠️ *Complete all fields to deploy*'}`;
}

export function formatRoomsList(rooms: any[]): string {
  if (rooms.length === 0) {
    return `📋 *Active Rooms*

No active rooms.

_Create a new room to get started._`;
  }

  let message = `📋 *Active Rooms*\n\n`;

  rooms.forEach((room, index) => {
    const status = room.status === 'OPEN' ? '🟢' : room.status === 'LOCKED' ? '🟡' : '🔴';
    message += `${index + 1}. ${status} *${room.title}*\n`;
    message += `   ${room.currentPlayers}/${room.cap} players | ${room.pool} SOL pool\n`;
    message += `   Oracle: ${room.oracleFeed}\n\n`;
  });

  return message;
}

export function formatUserManagement(totalUsers: number): string {
  return `👥 *User Management*

*Total Users:* ${totalUsers}

_Features coming soon:_
• Ban/unban users
• View user details
• Reset user wallets
• Export user list`;
}

