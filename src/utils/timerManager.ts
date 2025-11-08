/**
 * Timer Manager - Auto-refresh countdown timers in messages
 */

import { Telegraf } from 'telegraf';
import { getRoomDetails, listRooms } from '../domain/room';
import { formatRoomDetailsMessage, formatRoomsListMessage } from '../messages/rooms';
import { getRoomDetailsKeyboard, getRoomsListKeyboard } from '../keyboards/rooms';

interface ActiveTimer {
  chatId: number;
  messageId: number;
  type: 'room_details' | 'rooms_list';
  data: any; // roomId for details, page for list
  lastUpdate: number;
}

const activeTimers = new Map<string, ActiveTimer>();
let updateInterval: NodeJS.Timeout | null = null;

export function startTimerManager(bot: Telegraf) {
  // Update every 10 seconds
  updateInterval = setInterval(async () => {
    const now = Date.now();
    const timersToUpdate = Array.from(activeTimers.entries());

    for (const [key, timer] of timersToUpdate) {
      try {
        // Only update if last update was more than 9 seconds ago
        if (now - timer.lastUpdate < 9000) continue;

        if (timer.type === 'room_details') {
          const room = await getRoomDetails(timer.data.roomId);
          
          // Stop updating if room is locked or settled
          if (room.status !== 'OPEN') {
            activeTimers.delete(key);
            continue;
          }

          const canJoin = room.currentPlayers < room.cap;
          const message = formatRoomDetailsMessage(room);
          const keyboard = getRoomDetailsKeyboard(timer.data.roomId, canJoin);

          await bot.telegram.editMessageText(
            timer.chatId,
            timer.messageId,
            undefined,
            message,
            {
              parse_mode: 'Markdown',
              reply_markup: keyboard,
            }
          );

          timer.lastUpdate = now;
        } else if (timer.type === 'rooms_list') {
          const { rooms, totalPages } = await listRooms(timer.data.page, 5);
          
          const message = formatRoomsListMessage(rooms, timer.data.page, totalPages);
          const keyboard = getRoomsListKeyboard(
            rooms.map(r => ({
              id: r.id,
              title: r.title,
              status: r.status as 'OPEN' | 'LOCKED' | 'SETTLED',
              currentPlayers: r.currentPlayers,
              cap: r.cap,
              timeLeft: r.timeLeft,
            })),
            timer.data.page,
            totalPages
          );

          await bot.telegram.editMessageText(
            timer.chatId,
            timer.messageId,
            undefined,
            message,
            {
              parse_mode: 'Markdown',
              reply_markup: keyboard,
            }
          );

          timer.lastUpdate = now;
        }
      } catch (error: any) {
        // If message is not modified or deleted, remove timer
        if (
          error.description?.includes('message is not modified') ||
          error.description?.includes('message to edit not found')
        ) {
          activeTimers.delete(key);
        }
      }
    }
  }, 10000); // Check every 10 seconds

  console.log('✅ Timer manager started');
}

export function stopTimerManager() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  activeTimers.clear();
  console.log('✅ Timer manager stopped');
}

export function registerTimer(
  chatId: number,
  messageId: number,
  type: 'room_details' | 'rooms_list',
  data: any
) {
  const key = `${chatId}:${messageId}`;
  activeTimers.set(key, {
    chatId,
    messageId,
    type,
    data,
    lastUpdate: Date.now(),
  });
}

export function unregisterTimer(chatId: number, messageId: number) {
  const key = `${chatId}:${messageId}`;
  activeTimers.delete(key);
}


