/**
 * Settlement Job - Fast 5-second loop for room settlement
 * Auto-locks rooms at settle time, reads oracle price, computes winners, credits balances
 */

import { Telegraf } from 'telegraf';
import { prisma } from '../infra/db';
import { settleRoomWithWinner, sendSettlementNotifications } from '../domain/room';
import { resolvesolpriceMarket, resolvePumpfunMarket, resolveCoinPriceMarket } from '../domain/oracle';
import { getSolPrice, getCoinPrice } from '../infra/price';
import { Decimal } from '@prisma/client/runtime/library';

let settlementInterval: NodeJS.Timeout | null = null;

export function startSettleRooms(bot: Telegraf) {
  // Check every 5 seconds
  settlementInterval = setInterval(async () => {
    try {
      const now = new Date();

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
        console.log(`⚖️ Settling room: ${room.title}`);

        try {
          // If status is still OPEN at settle time, auto-LOCK with snapStart
          if (room.status === 'OPEN') {
            // Get current price as lock price (snapStart)
            let lockPrice: number | null = null;
            
            try {
              if (room.marketType === 'solprice' || room.marketType === 'sol_price') {
                lockPrice = await getSolPrice();
              } else if ((room.marketType === 'coin_price' || room.marketType === 'coin_mcap') && room.tokenSymbol) {
                lockPrice = await getCoinPrice(room.tokenSymbol);
              }
              // Add other market types as needed
            } catch (error) {
              console.error(`Failed to get lock price for room ${room.id}:`, error);
            }

            // Lock the room
            await prisma.room.update({
              where: { id: room.id },
              data: {
                status: 'LOCKED',
                lockPrice: lockPrice ? new Decimal(lockPrice) : null,
              },
            });

            console.log(`🔒 Auto-locked room ${room.id} at settle time (lock price: ${lockPrice || 'N/A'})`);
          }

          // Read oracle end price and compute winners
          let winningSide: 'YES' | 'NO' | null = null;
          let finalPrice: number | null = null;

          // Auto-resolve based on market type
          if ((room.marketType === 'solprice' || room.marketType === 'sol_price') && room.targetValue && room.targetDate) {
            const result = await resolvesolpriceMarket(
              parseFloat(room.targetValue.toString()),
              new Date(room.targetDate)
            );
            winningSide = result.winningSide as 'YES' | 'NO';
            finalPrice = result.actualValue || null;
            console.log(`  SOL Price result: ${winningSide} - ${result.message}`);
          } else if ((room.marketType === 'coin_price' || room.marketType === 'coin_mcap') && room.tokenSymbol && room.targetValue && room.targetDate) {
            const result = await resolveCoinPriceMarket(
              room.tokenSymbol,
              parseFloat(room.targetValue.toString()),
              new Date(room.targetDate)
            );
            winningSide = result.winningSide as 'YES' | 'NO';
            finalPrice = result.actualValue || null;
            console.log(`  Coin ${room.marketType === 'coin_mcap' ? 'Market Cap' : 'Price'} result: ${winningSide} - ${result.message}`);
          } else if (room.marketType === 'pumpfun_mcap' && room.tokenAddress && room.targetValue && room.targetDate) {
            const result = await resolvePumpfunMarket(
              room.tokenAddress,
              parseFloat(room.targetValue.toString()),
              new Date(room.targetDate)
            );
            winningSide = result.winningSide as 'YES' | 'NO';
            finalPrice = result.actualValue || null;
            console.log(`  Pump.fun result: ${winningSide} - ${result.message}`);
          } else {
            console.log(`  Unknown market type: ${room.marketType} - cannot auto-resolve`);
          }

          if (winningSide) {
            // Check if room is already settled (to avoid duplicates from instant settlement)
            const currentRoom = await prisma.room.findUnique({ where: { id: room.id } });
            
            if (currentRoom?.status === 'SETTLED') {
              console.log(`⚠️ Room ${room.id} already settled (likely by instant settlement), skipping`);
              continue;
            }
            
            // Settle room with winner (credits balances, sets SETTLED)
            await settleRoomWithWinner(room.id, winningSide);

            // Update room with final price
            if (finalPrice !== null) {
              await prisma.room.update({
                where: { id: room.id },
                data: {
                  settlePrice: new Decimal(finalPrice),
                },
              });
            }

            // Send settlement notifications to all participants (only for scheduled settlement)
            await sendSettlementNotifications(bot, room.id, winningSide);

            console.log(`✅ Settled room: ${room.title} - Winner: ${winningSide} (Price: ${finalPrice || 'N/A'})`);
          } else {
            console.log(`⚠️ Could not auto-resolve room: ${room.title} - needs manual resolution`);
          }
        } catch (error) {
          console.error(`Error settling room ${room.title}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in settlement job:', error);
    }
  }, 5000); // Run every 5 seconds

  console.log('✅ Settlement job started (5s loop)');
}

export function stopSettleRooms() {
  if (settlementInterval) {
    clearInterval(settlementInterval);
    settlementInterval = null;
  }
  console.log('✅ Settlement job stopped');
}

