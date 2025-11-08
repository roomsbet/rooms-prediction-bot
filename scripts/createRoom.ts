/**
 * Quick script to create a test room
 * Run with: npx tsx scripts/createRoom.ts
 */

import { config } from 'dotenv';
import { prisma } from '../src/infra/db';
import { Decimal } from '@prisma/client/runtime/library';

config();

async function createRoom() {
  try {
    const now = new Date();
    const lockTime = new Date(now.getTime() + 10 * 60000); // 10 minutes from now
    const settleTime = new Date(now.getTime() + 10 * 60000); // Same (settles immediately after lock)

    const room = await prisma.room.create({
      data: {
        title: 'will sol price hit 159$ in the next 10 minutes',
        oracleFeed: 'SOL/USD',
        cap: 5,
        minBet: new Decimal(0.05),
        maxBet: new Decimal(2.0),
        lockTime: lockTime,
        settleTime: settleTime,
        status: 'OPEN',
        marketType: 'sol_price',
        targetValue: new Decimal(159),
        targetDate: settleTime,
      },
    });

    console.log('✅ Room created successfully!');
    console.log(`Room ID: ${room.id}`);
    console.log(`Title: ${room.title}`);
    console.log(`Status: ${room.status}`);
    console.log(`Lock Time: ${lockTime.toLocaleString()}`);
    console.log(`Settle Time: ${settleTime.toLocaleString()}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error creating room:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createRoom();

