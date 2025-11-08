/**
 * Rooms Won Handler - Compact table-like display of won rooms
 */

import { Context } from 'telegraf';
import { prisma } from '../infra/db';

interface WonRoom {
  time: string; // hh:mm format
  roomId: string; // Room ID for display
  title: string; // Room title (truncated)
  staked: number; // Staked amount
  profit: number; // Profit amount
}

/**
 * Format time as hh:mm
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Truncate title to fit in compact format
 */
function truncateTitle(title: string, maxLength: number = 20): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

/**
 * Format rooms won list with monospaced table-like alignment
 */
function formatRoomsWonList(wonRooms: WonRoom[], page: number, totalPages: number): string {
  if (wonRooms.length === 0) {
    return `🏆 *Rooms Won*\n\nNo wins yet.\n\n_Keep betting to get your first win!_`;
  }

  let message = `🏆 *Rooms Won*\n\n`;
  
  // Format each room as numbered list item
  wonRooms.forEach((room, index) => {
    const profit = room.profit.toFixed(4);
    const total = (room.staked + room.profit).toFixed(4);
    
    message += `${index + 1}. ${room.title}\n`;
    message += `   Profit: +${profit} SOL | Total: ${total} SOL\n\n`;
  });
  
  // Calculate totals
  const totalProfit = wonRooms.reduce((sum, r) => sum + r.profit, 0);
  const totalStaked = wonRooms.reduce((sum, r) => sum + r.staked, 0);
  const totalWinnings = totalStaked + totalProfit;
  
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `*Total Profit:* +${totalProfit.toFixed(4)} SOL\n`;
  message += `*Total Winnings:* ${totalWinnings.toFixed(4)} SOL`;
  
  if (totalPages > 1) {
    message += `\n\n_Page ${page + 1}/${totalPages}_`;
  }
  
  return message;
}

/**
 * Get keyboard for rooms won list
 */
function getRoomsWonKeyboard(page: number, totalPages: number) {
  const buttons: any[][] = [];
  
  // Pagination row
  if (totalPages > 1) {
    const navRow: any[] = [];
    if (page > 0) {
      navRow.push({ text: '◀ Prev', callback_data: `won:list:p=${page}` });
    }
    if (page < totalPages - 1) {
      navRow.push({ text: 'Next ▶', callback_data: `won:list:p=${page + 2}` });
    }
    if (navRow.length > 0) {
      buttons.push(navRow);
    }
  }
  
  // Back button
  buttons.push([
    { text: '⬅ Back', callback_data: 'cb:back_dashboard' }
  ]);
  
  // Dismiss button
  buttons.push([
    { text: '× Dismiss', callback_data: 'cb:dismiss' }
  ]);
  
  return { inline_keyboard: buttons };
}

/**
 * Handle rooms won list view
 */
export async function handleRoomsWon(ctx: Context, page: number = 0) {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!user) {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('❌ User not found');
      }
      return;
    }

    // Query won bets with room data
    const itemsPerPage = 10;
    const wonBets = await prisma.bet.findMany({
      where: {
        userId: user.id,
        settled: true,
        won: true,
      },
      include: { 
        room: {
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: page * itemsPerPage,
      take: itemsPerPage,
    });

    // Get total count for pagination
    const totalCount = await prisma.bet.count({
      where: {
        userId: user.id,
        settled: true,
        won: true,
      },
    });
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    // Get all settled rooms for room numbering
    const allSettledRooms = await prisma.room.findMany({
      where: { status: 'SETTLED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true },
    });

    // Format won rooms data
    const wonRooms: WonRoom[] = wonBets.map((bet) => {
      const betAmount = bet.amount.toNumber();
      const payout = bet.payout.toNumber();
      const profit = payout - betAmount;
      
      // Get room number (find index in settled rooms list)
      const roomIndex = allSettledRooms.findIndex(r => r.id === bet.room.id);
      const roomNumber = roomIndex >= 0 
        ? (allSettledRooms.length - roomIndex).toString() 
        : bet.room.id.substring(0, 8); // Fallback to ID if not found
      
      return {
        time: formatTime(bet.createdAt),
        roomId: roomNumber,
        title: bet.room.title,
        staked: betAmount,
        profit: profit,
      };
    });
    
    const message = formatRoomsWonList(wonRooms, page, totalPages);
    const keyboard = getRoomsWonKeyboard(page, totalPages);
    
    // Use editMessageText if callback query exists, otherwise send new message
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      await ctx.answerCbQuery();
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error('Error in handleRoomsWon:', error);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Error loading wins');
    } else {
      await ctx.reply('❌ Error loading wins. Please try again.');
    }
  }
}

