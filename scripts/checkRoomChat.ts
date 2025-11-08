/**
 * Quick script to check room chat status
 */

import { config } from 'dotenv';
import { prisma } from '../src/infra/db';

config();

async function checkRoomChat() {
  try {
    // Get the most recent OPEN room
    const room = await prisma.room.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });

    if (!room) {
      console.log('❌ No OPEN room found');
      await prisma.$disconnect();
      return;
    }

    console.log(`\n📊 Room: ${room.title}`);
    console.log(`Room ID: ${room.id}`);
    console.log(`Status: ${room.status}`);
    console.log(`Chat ID: ${room.chatId || 'NOT ASSIGNED'}`);
    console.log(`Invite Link: ${room.inviteLink || 'N/A'}\n`);

    // Check chat pool
    const chatPool = await prisma.chatPool.findMany({
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\n💬 Chat Pool Status:`);
    console.log(`Total chats: ${chatPool.length}`);
    const freeChats = chatPool.filter(c => c.status === 'FREE');
    const assignedChats = chatPool.filter(c => c.status === 'ASSIGNED');
    console.log(`🟢 FREE: ${freeChats.length}`);
    console.log(`🔴 ASSIGNED: ${assignedChats.length}\n`);

    if (freeChats.length === 0) {
      console.log('⚠️  No free chats available in pool!');
      console.log('   Add chats via: /admin → Chat Management → Add Chat\n');
    } else {
      console.log('✅ Free chats available - chat should be assigned automatically\n');
    }

    if (!room.chatId) {
      console.log('⏳ Chat not yet assigned. The settlementChecker will assign one within 30 seconds.');
      console.log('   Make sure your bot is running!\n');
    } else {
      console.log(`✅ Chat assigned! Chat ID: ${room.chatId}`);
      if (room.inviteLink) {
        console.log(`   Invite Link: ${room.inviteLink}\n`);
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkRoomChat();

