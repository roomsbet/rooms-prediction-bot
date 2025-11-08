/**
 * Reassign chat from one room to another
 */

import { config } from 'dotenv';
import { prisma } from '../src/infra/db';

config();

async function reassignChat() {
  try {
    // Get the new room
    const newRoom = await prisma.room.findFirst({
      where: { 
        title: 'will sol price hit 159$ in the next 10 minutes',
        status: 'OPEN'
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!newRoom) {
      console.log('❌ New room not found');
      await prisma.$disconnect();
      return;
    }

    // Get the assigned chat
    const assignedChat = await prisma.chatPool.findFirst({
      where: { status: 'ASSIGNED' },
    });

    if (!assignedChat) {
      console.log('❌ No assigned chat found');
      await prisma.$disconnect();
      return;
    }

    const chatId = assignedChat.chatId;
    const oldRoomId = assignedChat.roomId;

    console.log(`\n🔄 Reassigning chat ${chatId}`);
    console.log(`From room: ${oldRoomId}`);
    console.log(`To room: ${newRoom.id} (${newRoom.title})\n`);

    // Update old room - clear chat
    if (oldRoomId) {
      await prisma.room.update({
        where: { id: oldRoomId },
        data: {
          chatId: null,
          inviteLink: null,
        },
      });
      console.log(`✅ Cleared chat from old room`);
    }

    // Update new room - assign chat
    await prisma.room.update({
      where: { id: newRoom.id },
      data: {
        chatId: chatId,
        // Keep inviteLink null for now - it will be created when bot assigns chat
      },
    });
    console.log(`✅ Assigned chat to new room`);

    // Update chat pool
    await prisma.chatPool.update({
      where: { id: assignedChat.id },
      data: {
        roomId: newRoom.id,
        // Keep status as ASSIGNED
      },
    });
    console.log(`✅ Updated chat pool\n`);

    console.log(`✅ Chat reassigned successfully!`);
    console.log(`Chat ID: ${chatId}`);
    console.log(`New Room: ${newRoom.title}`);
    console.log(`\nNote: You may need to restart your bot or wait for settlementChecker to set up the invite link.\n`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

reassignChat();

