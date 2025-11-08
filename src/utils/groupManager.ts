/**
 * Group Manager - Handles Telegram group creation and management for battle arenas
 */

import { Telegraf } from 'telegraf';
import { prisma } from '../infra/db';

/**
 * Create a new Telegram group for a room
 * Note: Due to Telegram API limitations, we need admin to create group manually
 * This function handles the setup once group is created
 */
export async function createRoomGroup(
  bot: Telegraf,
  roomId: string,
  groupChatId: string
): Promise<string> {
  try {
    // Get room details
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    // Set group title
    const groupTitle = `🏛️ ${room.title}`;
    await bot.telegram.setChatTitle(groupChatId, groupTitle);

    // Set group description
    const description = 
      `⚔️ BATTLE ARENA\n\n` +
      `${room.title}\n\n` +
      `📊 Min Bet: ${room.minBet} SOL\n` +
      `${room.maxBet ? `📈 Max Bet: ${room.maxBet} SOL\n` : ''}` +
      `👥 Capacity: ${room.cap} players\n\n` +
      `Use /bet YES <amount> or /bet NO <amount> to place your bet!\n` +
      `Use /stats to see current standings.`;
    
    await bot.telegram.setChatDescription(groupChatId, description);

    // Generate invite link
    const inviteLink = await bot.telegram.exportChatInviteLink(groupChatId);

    // Update room with group info
    await prisma.room.update({
      where: { id: roomId },
      data: {
        groupChatId,
        inviteLink,
      },
    });

    // Send welcome message
    await bot.telegram.sendMessage(
      groupChatId,
      `🏛️ *BATTLE ARENA ACTIVATED*\n\n` +
      `Welcome to *${room.title}*!\n\n` +
      `⚔️ This is a prediction market battle arena\\.\n` +
      `💰 Place your bets and compete with others\\!\n\n` +
      `*How to Play:*\n` +
      `• Use /bet YES \\<amount\\> or /bet NO \\<amount\\>\n` +
      `• Use /stats to check the pool\n` +
      `• Trash talk and strategize with opponents\\!\n\n` +
      `⏰ Betting locks at: ${room.lockTime.toLocaleString()}\n` +
      `🎯 Settlement: ${room.settleTime.toLocaleString()}\n\n` +
      `_May the best prediction win\\!_ 🎲`,
      { parse_mode: 'MarkdownV2' }
    );

    return inviteLink;
  } catch (error) {
    console.error('Error creating room group:', error);
    throw error;
  }
}

/**
 * Delete a room's group chat (NUKE)
 */
export async function deleteRoomGroup(
  bot: Telegraf,
  roomId: string
): Promise<void> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || !room.groupChatId) {
      console.log(`No group to delete for room ${roomId}`);
      return;
    }

    // Send final message
    await bot.telegram.sendMessage(
      room.groupChatId,
      `💥 *ARENA CLOSING*\n\n` +
      `Market has been settled\\.\n` +
      `This group will be deleted in 10 seconds\\.\n\n` +
      `See you in the next battle\\! 🏛️`,
      { parse_mode: 'MarkdownV2' }
    );

    // Wait 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Delete the group
    await bot.telegram.leaveChat(room.groupChatId);
    
    console.log(`✅ Group ${room.groupChatId} nuked for room ${roomId}`);
  } catch (error) {
    console.error('Error deleting room group:', error);
    throw error;
  }
}

/**
 * Post update to room group
 */
export async function postToRoomGroup(
  bot: Telegraf,
  roomId: string,
  message: string,
  parseMode: 'Markdown' | 'MarkdownV2' | 'HTML' = 'Markdown'
): Promise<void> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || !room.groupChatId) {
      console.log(`No group for room ${roomId}`);
      return;
    }

    await bot.telegram.sendMessage(
      room.groupChatId,
      message,
      { parse_mode: parseMode }
    );
  } catch (error) {
    console.error('Error posting to room group:', error);
  }
}

/**
 * Update group title with countdown
 */
export async function updateGroupTitle(
  bot: Telegraf,
  roomId: string,
  timeLeft: string
): Promise<void> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || !room.groupChatId) {
      return;
    }

    const newTitle = `🏛️ ${room.title} | ⏰ ${timeLeft}`;
    await bot.telegram.setChatTitle(room.groupChatId, newTitle);
  } catch (error) {
    // Silently fail (might hit rate limits)
    console.error('Error updating group title:', error);
  }
}


