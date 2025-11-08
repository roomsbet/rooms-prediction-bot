/**
 * Check which room has the assigned chat
 */

import { config } from 'dotenv';
import { prisma } from '../src/infra/db';

config();

async function checkAssignedChat() {
  try {
    const assignedChat = await prisma.chatPool.findFirst({
      where: { status: 'ASSIGNED' },
      include: {
        // Note: roomId is just a string, not a relation
      },
    });

    if (assignedChat) {
      console.log(`\n🔴 Assigned Chat:`);
      console.log(`Chat ID: ${assignedChat.chatId}`);
      console.log(`Room ID: ${assignedChat.roomId || 'N/A'}\n`);

      if (assignedChat.roomId) {
        const room = await prisma.room.findUnique({
          where: { id: assignedChat.roomId },
        });

        if (room) {
          console.log(`Room Title: ${room.title}`);
          console.log(`Room Status: ${room.status}\n`);
        }
      }
    }

    // Check if we can free it up or need to add more
    const freeChats = await prisma.chatPool.findMany({
      where: { status: 'FREE' },
    });

    console.log(`\n💡 Options:`);
    if (freeChats.length === 0) {
      console.log(`1. Add more chats: /admin → Chat Management → Add Chat`);
      console.log(`2. Wait for the assigned room to settle (chat will be freed)`);
      console.log(`3. Manually free the chat (if the room is settled)\n`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkAssignedChat();

