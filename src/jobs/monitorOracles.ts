/**
 * Oracle Monitoring Job - Instant settlement when market cap targets are reached
 * Checks market caps every 10 seconds for pumpfun rooms
 */

import { Telegraf } from 'telegraf';
import { prisma } from '../infra/db';
import { getTokenMarketData, getCoinPrice } from '../infra/price';
import { settleRoomInstantly } from '../domain/room';

let monitoringInterval: NodeJS.Timeout | null = null;

export function startOracleMonitoring(bot: Telegraf) {
  // Check every 3 seconds for fastest updates
  monitoringInterval = setInterval(async () => {
    try {
      // Get all active rooms that need monitoring (pumpfun, coin_price, coin_mcap)
      const activeRooms = await prisma.room.findMany({
        where: {
          status: 'OPEN',
          marketType: { in: ['pumpfun_mcap', 'coin_price', 'coin_mcap'] },
        },
      });

      for (const room of activeRooms) {
        if (!room.targetValue) {
          continue;
        }
        
        try {
          if (room.marketType === 'pumpfun_mcap') {
            if (!room.tokenAddress) continue;
            
            // Query DexScreener for current market cap (with retry)
            let tokenData = await getTokenMarketData(room.tokenAddress);
            
            // Retry once if failed
            if (!tokenData) {
              await new Promise(resolve => setTimeout(resolve, 500));
              tokenData = await getTokenMarketData(room.tokenAddress);
            }
            
            if (!tokenData) {
              console.log(`⚠️  No data for ${room.tokenSymbol} (${room.tokenAddress})`);
              continue;
            }
            
            const currentMcap = tokenData.marketCap;
            const targetMcap = parseFloat(room.targetValue.toString());
            const progress = ((currentMcap / targetMcap) * 100).toFixed(1);
            
            console.log(`📊 ${room.tokenSymbol}: $${(currentMcap / 1_000_000).toFixed(2)}M / $${(targetMcap / 1_000_000).toFixed(2)}M (${progress}%)`);
            
            // Check if target reached
            if (currentMcap >= targetMcap) {
              console.log(`🎯 TARGET REACHED! ${room.tokenSymbol} hit $${(targetMcap / 1_000_000).toFixed(2)}M`);
              console.log(`   Current: $${(currentMcap / 1_000_000).toFixed(2)}M`);
              console.log(`   Settling room instantly...`);
              
              await settleRoomInstantly(bot, room.id, 'YES', currentMcap);
            }
          } else if (room.marketType === 'coin_price' && room.tokenSymbol) {
            // Monitor coin price markets
            const currentPrice = await getCoinPrice(room.tokenSymbol);
            
            if (currentPrice === 0) {
              console.log(`⚠️  No price data for ${room.tokenSymbol}`);
              continue;
            }
            
            const targetPrice = parseFloat(room.targetValue.toString());
            const progress = ((currentPrice / targetPrice) * 100).toFixed(1);
            
            console.log(`💰 ${room.tokenSymbol}: $${currentPrice.toFixed(2)} / $${targetPrice.toFixed(2)} (${progress}%)`);
            
            // Check if target reached
            if (currentPrice >= targetPrice) {
              console.log(`🎯 TARGET REACHED! ${room.tokenSymbol} hit $${targetPrice.toFixed(2)}`);
              console.log(`   Current: $${currentPrice.toFixed(2)}`);
              console.log(`   Settling room instantly...`);
              
              await settleRoomInstantly(bot, room.id, 'YES', currentPrice);
            }
          } else if (room.marketType === 'coin_mcap' && room.tokenSymbol) {
            // Monitor coin market cap markets
            // For market cap, we need to get it from CoinGecko or similar API
            // For now, we'll use getTokenMarketData which works for Solana tokens
            const tokenData = await getTokenMarketData(room.tokenAddress || '');
            
            if (!tokenData) {
              console.log(`⚠️  No market cap data for ${room.tokenSymbol}`);
              continue;
            }
            
            const currentMcap = tokenData.marketCap;
            const targetMcap = parseFloat(room.targetValue.toString());
            const progress = ((currentMcap / targetMcap) * 100).toFixed(1);
            
            console.log(`📊 ${room.tokenSymbol} Market Cap: $${(currentMcap / 1_000_000).toFixed(2)}M / $${(targetMcap / 1_000_000).toFixed(2)}M (${progress}%)`);
            
            // Check if target reached
            if (currentMcap >= targetMcap) {
              console.log(`🎯 TARGET REACHED! ${room.tokenSymbol} hit $${(targetMcap / 1_000_000).toFixed(2)}M market cap`);
              console.log(`   Current: $${(currentMcap / 1_000_000).toFixed(2)}M`);
              console.log(`   Settling room instantly...`);
              
              await settleRoomInstantly(bot, room.id, 'YES', currentMcap);
            }
          }
        } catch (error) {
          console.error(`Error monitoring ${room.tokenSymbol || room.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in oracle monitoring job:', error);
    }
  }, 3000); // Run every 3 seconds for fastest updates
  
  console.log('✅ Oracle monitoring started (3s loop)');
}

export function stopOracleMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  console.log('✅ Oracle monitoring stopped');
}

