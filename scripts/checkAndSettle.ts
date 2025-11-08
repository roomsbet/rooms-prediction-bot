/**
 * Check and manually settle a room if needed
 */

import { config } from 'dotenv';
import { prisma } from '../src/infra/db';

config();

async function checkAndSettle() {
  try {
    // Find the room
    const room = await prisma.room.findFirst({
      where: {
        title: 'will sol price hit 159$ in the next 10 minutes',
        status: { in: ['OPEN', 'LOCKED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!room) {
      console.log('❌ Room not found or already settled');
      await prisma.$disconnect();
      return;
    }

    console.log(`\n📊 Room: ${room.title}`);
    console.log(`Status: ${room.status}`);
    console.log(`Settle Time: ${room.settleTime.toLocaleString()}`);
    console.log(`Current Time: ${new Date().toLocaleString()}`);
    console.log(`Time Past Settle: ${Math.floor((new Date().getTime() - room.settleTime.getTime()) / 1000)} seconds\n`);

    const now = new Date();
    if (room.settleTime <= now) {
      console.log('✅ Room should be settled! Triggering settlement...\n');
      
      // Import settlement function
      const { settleRoomWithWinner } = await import('../src/domain/room');
      const { resolvesolpriceMarket } = await import('../src/domain/oracle');
      
      // Resolve the market
      if (room.marketType === 'sol_price' && room.targetValue && room.targetDate) {
        const result = await resolvesolpriceMarket(
          parseFloat(room.targetValue.toString()),
          new Date(room.targetDate)
        );
        
        console.log(`Market Resolution: ${result.winningSide} - ${result.message}\n`);
        
        if (result.winningSide) {
          await settleRoomWithWinner(room.id, result.winningSide as 'YES' | 'NO');
          console.log(`✅ Room settled! Winner: ${result.winningSide}\n`);
        } else {
          console.log('❌ Could not resolve market automatically\n');
        }
      } else {
        console.log('⚠️ Room type not supported for auto-settlement\n');
      }
    } else {
      console.log('⏳ Room not ready to settle yet\n');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkAndSettle();

