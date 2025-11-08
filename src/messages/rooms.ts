/**
 * Rooms Messages - Message templates for room listings and details
 */

export interface RoomListItem {
  id: string;
  title: string;
  status: string;
  currentPlayers: number;
  cap: number;
  timeLeft?: string;
  pool: number;
  roomNumber?: number;
}

export function formatRoomsListMessage(rooms: RoomListItem[], page: number, totalPages: number): string {
  if (rooms.length === 0) {
    return `🏛️ *Available Rooms*

No active rooms at the moment.

_New rooms are created regularly. Check back soon!_`;
  }

  let message = `🏛️ *Available Rooms* (Page ${page + 1}/${totalPages})\n\n`;
  message += `_Click on a room to view details and join_\n\n`;
  
  rooms.forEach((room, index) => {
    const statusEmoji = getStatusEmoji(room.status);
    const roomNumber = room.roomNumber || (page * 5 + index + 1);
    message += `${roomNumber}. ${statusEmoji} *${room.title}*\n`;
    message += `   Players: ${room.currentPlayers}/${room.cap} | Pool: ${room.pool.toFixed(2)} SOL\n`;
    if (room.timeLeft) {
      message += `   Time: ⏱ ${room.timeLeft}\n`;
    }
    message += `\n`;
  });
  
  return message;
}

export interface RoomDetails {
  id: string;
  title: string;
  description?: string;
  status: string;
  oracleFeed: string;
  currentPlayers: number;
  cap: number;
  pool: number;
  longPool: number;
  shortPool: number;
  minBet: number;
  maxBet?: number;
  lockTime: Date;
  settleTime: Date;
  lockPrice?: number;
  inviteLink?: string;
  groupChatId?: string;
  yesUsernames?: string[];
  noUsernames?: string[];
  creatorUsername?: string;
}

export function formatRoomDetailsMessage(room: RoomDetails): string {
  const yesPercent = room.pool > 0 ? ((room.longPool / room.pool) * 100).toFixed(1) : '0.0';
  const noPercent = room.pool > 0 ? ((room.shortPool / room.pool) * 100).toFixed(1) : '0.0';
  
  const now = new Date();
  const timeToLock = Math.max(0, Math.floor((room.lockTime.getTime() - now.getTime()) / 1000));
  const timeToSettle = Math.max(0, Math.floor((room.settleTime.getTime() - now.getTime()) / 1000));
  
  let message = `🏛️ *${room.title}*\n\n`;
  
  // Show creator if room was created by a user (not admin)
  if (room.creatorUsername) {
    message += `📝 Created by ${room.creatorUsername}\n\n`;
  }
  
  // Status
  message += `Status: ${room.status}\n\n`;
  
  // Players and pool
  message += `Players: ${room.currentPlayers}/${room.cap} | Pool: ${room.pool.toFixed(2)} SOL\n\n`;
  
  // YES/NO pools (without usernames)
  message += `✅ YES ${room.longPool.toFixed(2)} | ❌ NO ${room.shortPool.toFixed(2)}\n\n`;
  
  // Betting limits
  const betLimits = room.maxBet 
    ? `Min ${room.minBet.toFixed(2)} • Max ${room.maxBet.toFixed(2)} SOL`
    : `Min ${room.minBet.toFixed(2)} SOL`;
  message += `${betLimits}\n\n`;
  
  // Settle time - only show if not settled and time hasn't passed
  if (room.status !== 'SETTLED' && timeToSettle > 0) {
    message += `Settles: ${formatTimeLeft(timeToSettle)}\n\n`;
  } else if (room.status === 'LOCKED' && timeToSettle <= 0) {
    message += `Settling...\n\n`;
  }
  
  message += `──────────────\n\n`;
  
  // Players in this bet section - show all players together
  message += `*Players in this bet:*\n`;
  const allPlayers: string[] = [];
  if (room.yesUsernames && room.yesUsernames.length > 0) {
    allPlayers.push(...room.yesUsernames);
  }
  if (room.noUsernames && room.noUsernames.length > 0) {
    allPlayers.push(...room.noUsernames);
  }
  
  if (allPlayers.length > 0) {
    message += `${allPlayers.join(', ')}\n`;
  } else {
    message += `(none)\n`;
  }
  
  message += `\n`;
  
  // Status message
  if (room.status === 'QUEUING') {
    message += `⏳ Waiting for launch`;
  } else if (room.status === 'OPEN' && room.currentPlayers < room.cap) {
    message += `Choose YES or NO to bet`;
  } else if (room.status === 'LOCKED') {
    message += `Locked, waiting for settlement`;
  }
  
  return message;
}

export function formatJoinRoomMessage(roomTitle: string, side: string, amount: number): string {
  const emoji = side === 'YES' ? '✅' : '❌';
  
  return `${emoji} *Join ${roomTitle}*

*Betting:* ${side}
*Amount:* ${amount.toFixed(4)} SOL

⚠️ *Confirm your bet:*
• Once confirmed, bets cannot be cancelled
• Winners will be paid after settlement
• 3% fee applies (2% protocol, 1% host)

_Click "Confirm Bet" to proceed_`;
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'OPEN': return '🟢';
    case 'LOCKED': return '🟡';
    case 'SETTLED': return '🔴';
    case 'CANCELLED': return '⚫';
    default: return '⚪';
  }
}

function formatTimeLeft(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

