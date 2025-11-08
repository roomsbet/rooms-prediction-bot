/**
 * Rooms Keyboard - Room list and details inline keyboards
 */

import { InlineKeyboardMarkup } from 'telegraf/types';

export interface RoomCard {
  id: string;
  title: string;
  status: 'QUEUING' | 'OPEN' | 'LOCKED' | 'SETTLED';
  currentPlayers: number;
  cap: number;
  timeLeft?: string; // e.g., "05:30"
  roomNumber?: number; // Sequential room number
}

export function getRoomsListKeyboard(rooms: RoomCard[], page: number, totalPages: number): InlineKeyboardMarkup {
  const buttons: any[][] = [];
  
  // Room cards (max 5 per page)
  rooms.forEach((room) => {
    const emoji = getRoomStatusEmoji(room);
    const roomNumber = room.roomNumber || 1; // Use provided room number to match display
    
    const label = `${emoji} ROOM #${roomNumber} (${room.currentPlayers}/${room.cap})${room.timeLeft ? ` ⏱ ${room.timeLeft}` : ''}`;
    buttons.push([
      { text: label, callback_data: `cb:room_details:${room.id}` }
    ]);
  });
  
  // Pagination
  if (totalPages > 1) {
    const navRow: any[] = [];
    if (page > 0) {
      navRow.push({ text: '⬅️ Prev', callback_data: `cb:rooms_page:${page - 1}` });
    }
    navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'cb:noop' });
    if (page < totalPages - 1) {
      navRow.push({ text: 'Next ➡️', callback_data: `cb:rooms_page:${page + 1}` });
    }
    buttons.push(navRow);
  }
  
  // Create Room button
  buttons.push([
    { text: '➕ Create Room', callback_data: 'user:create_start' }
  ]);
  
  // Refresh and Back buttons side-by-side (Back on left, Refresh on right)
  buttons.push([
    { text: '⬅️ Back to Dashboard', callback_data: 'cb:back_dashboard' },
    { text: '🔄 Refresh', callback_data: 'cb:enter_rooms' }
  ]);
  
  buttons.push([
    { text: '× Dismiss', callback_data: 'cb:dismiss' }
  ]);
  
  return { inline_keyboard: buttons };
}

export function getRoomDetailsKeyboard(roomId: string, canJoin: boolean, roomStatus?: string): InlineKeyboardMarkup {
  const buttons: any[][] = [];
  
  if (canJoin) {
    if (roomStatus === 'QUEUING') {
      // Queue system - single button to join queue
      buttons.push([
        { text: '⏳ Join Queue', callback_data: `cb:join_queue:${roomId}` }
      ]);
    } else {
      // Normal betting - YES/NO buttons (top row)
      buttons.push([
        { text: '✅ YES', callback_data: `cb:join_room:${roomId}:YES` },
        { text: '❌ NO', callback_data: `cb:join_room:${roomId}:NO` }
      ]);
    }
  }
  
  // Refresh + Back side-by-side (Back on left, Refresh on right)
  buttons.push([
    { text: '⬅️ Back', callback_data: 'cb:enter_rooms' },
    { text: '🔄 Refresh', callback_data: `cb:room_details:${roomId}` }
  ]);
  
  buttons.push([
    { text: '× Dismiss', callback_data: 'cb:dismiss' }
  ]);
  
  return { inline_keyboard: buttons };
}

export function getJoinRoomKeyboard(roomId: string, side: 'YES' | 'NO', amount: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Confirm Bet', callback_data: `cb:confirm_bet:${roomId}:${side}:${amount}` }
      ],
      [
        { text: '⬅️ Back', callback_data: `cb:room_details:${roomId}` }
      ],
      [
        { text: '× Dismiss', callback_data: 'cb:dismiss' }
      ]
    ]
  };
}

function getRoomStatusEmoji(room: RoomCard): string {
  // Special emoji for queuing (waiting to launch)
  if (room.status === 'QUEUING') {
    return '⏳'; // Waiting for launch
  }
  
  if (room.status === 'LOCKED' || room.status === 'SETTLED') {
    return '🔴';
  }
  
  if (room.currentPlayers >= room.cap) {
    return '🔴'; // Full
  }
  
  if (room.currentPlayers >= room.cap - 1) {
    return '🟡'; // Almost full
  }
  
  // Check time left if available
  if (room.timeLeft) {
    // Parse time format: "8h 58m", "45m 30s", or "30s"
    const hourMatch = room.timeLeft.match(/(\d+)h/);
    const minMatch = room.timeLeft.match(/(\d+)m/);
    const secMatch = room.timeLeft.match(/(\d+)s/);
    
    let totalSeconds = 0;
    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    if (secMatch) totalSeconds += parseInt(secMatch[1]);
    
    if (totalSeconds <= 60) {
      return '🟡'; // Less than 1 minute
    }
  }
  
  return '🟢'; // Joinable
}

