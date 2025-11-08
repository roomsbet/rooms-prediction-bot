/**
 * Settlement Checker - Auto-settle rooms when time is up
 */

import { Telegraf } from 'telegraf';
import { prisma } from '../infra/db';
import { settleRoom } from '../domain/room';
import { resolvesolpriceMarket, resolvePumpfunMarket } from '../domain/oracle';

let settlementInterval: NodeJS.Timeout | null = null;

export function startSettlementChecker(bot: Telegraf) {
  // Check every 30 seconds
  settlementInterval = setInterval(async () => {
    try {
      const now = new Date();

      // Find rooms that need to be locked
      const roomsToLock = await prisma.room.findMany({
        where: {
          status: 'OPEN',
          lockTime: { lte: now },
        },
      });

      for (const room of roomsToLock) {
        await prisma.room.update({
          where: { id: room.id },
          data: { status: 'LOCKED' },
        });

        console.log(`🔒 Locked room: ${room.title}`);
      }

      // Find rooms that need settlement
      const roomsToSettle = await prisma.room.findMany({
        where: {
          status: { in: ['OPEN', 'LOCKED'] },
          settleTime: { lte: now },
        },
        include: {
          bets: true,
        },
      });

      for (const room of roomsToSettle) {
        console.log(`⚖️ Auto-settling room: ${room.title}`);

        try {
          let winningSide: 'YES' | 'NO' | null = null;

          // Auto-resolve based on market type
          if (room.marketType === 'solprice' && room.targetValue && room.targetDate) {
            const result = await resolvesolpriceMarket(
              parseFloat(room.targetValue.toString()),
              new Date(room.targetDate)
            );
            winningSide = result.winningSide as 'YES' | 'NO';
            console.log(`  SOL Price result: ${winningSide} - ${result.message}`);
          } else if (room.marketType === 'pumpfun_mcap' && room.tokenAddress && room.targetValue && room.targetDate) {
            const result = await resolvePumpfunMarket(
              room.tokenAddress,
              parseFloat(room.targetValue.toString()),
              new Date(room.targetDate)
            );
            winningSide = result.winningSide as 'YES' | 'NO';
            console.log(`  Pump.fun result: ${winningSide} - ${result.message}`);
          }

          if (winningSide) {
            // Settle room with winner (this will update status, pay winners, etc.)
            const { settleRoomWithWinner } = await import('../domain/room');
            await settleRoomWithWinner(room.id, winningSide);

            console.log(`✅ Settled room: ${room.title} - Winner: ${winningSide}`);
          } else {
            console.log(`⚠️ Could not auto-resolve room: ${room.title} - needs manual resolution`);
          }
        } catch (error) {
          console.error(`Error settling room ${room.title}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in settlement checker:', error);
    }
  }, 30000); // Run every 30 seconds

  console.log('✅ Settlement checker started');
}

export function stopSettlementChecker() {
  if (settlementInterval) {
    clearInterval(settlementInterval);
    settlementInterval = null;
  }
  console.log('✅ Settlement checker stopped');
}


