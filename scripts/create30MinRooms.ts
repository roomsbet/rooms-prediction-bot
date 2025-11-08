/**
 * Create 3 rooms with 1-hour settlement
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function create30MinRooms() {
  try {
    const now = new Date();
    
    // All rooms settle in 1 hour
    const settleTime = new Date(now.getTime() + 60 * 60 * 1000);
    const lockTime = new Date(settleTime.getTime() - 5 * 60 * 1000); // 5 min before settle

    // Room 1: MONEROCHAN - 3m market cap in 1 hour
    const room1 = await prisma.room.create({
      data: {
        title: 'Will $MONEROCHAN hit 3m market cap in the next hour',
        oracleFeed: 'MONEROCHAN/USD',
        status: 'OPEN',
        marketType: 'pumpfun_mcap',
        tokenAddress: 'H5b4iYiZYycr7fmQ1dMj7hdfLGAEPcDH261K4hugpump',
        tokenSymbol: 'MONEROCHAN',
        targetValue: new Decimal(3_000_000),
        targetDate: settleTime,
        cap: 5,
        minBet: new Decimal(0.10),
        maxBet: new Decimal(5.00),
        lockTime,
        settleTime,
      },
    });

    console.log(`✅ Created Room 1: ${room1.title}`);
    console.log(`   Settles at: ${settleTime.toLocaleString()}`);

    // Room 2: SOL Price - $155 in 1 hour
    const room2 = await prisma.room.create({
      data: {
        title: 'Will SOL price reach 155$ in the next hour',
        oracleFeed: 'SOL/USD',
        status: 'OPEN',
        marketType: 'sol_price',
        targetValue: new Decimal(155),
        targetDate: settleTime,
        cap: 5,
        minBet: new Decimal(0.10),
        maxBet: new Decimal(5.00),
        lockTime,
        settleTime,
      },
    });

    console.log(`✅ Created Room 2: ${room2.title}`);
    console.log(`   Settles at: ${settleTime.toLocaleString()}`);

    // Room 3: SPSN - 4m market cap in 1 hour
    const room3 = await prisma.room.create({
      data: {
        title: 'Will $SPSN hit 4m market cap in the next hour?',
        oracleFeed: 'SPSN/USD',
        status: 'OPEN',
        marketType: 'pumpfun_mcap',
        tokenAddress: 'Sg4k4iFaEeqhv5866cQmsFTMhRx8sVCPAq2j8Xcpump',
        tokenSymbol: 'SPSN',
        targetValue: new Decimal(4_000_000),
        cap: 5,
        minBet: new Decimal(0.10),
        maxBet: new Decimal(5.00),
        lockTime,
        settleTime,
      },
    });

    console.log(`✅ Created Room 3: ${room3.title}`);
    console.log(`   Settles at: ${settleTime.toLocaleString()}`);

    console.log('\n✅ All 3 rooms created successfully!');
    console.log(`\nRoom IDs:`);
    console.log(`  1. ${room1.id}`);
    console.log(`  2. ${room2.id}`);
    console.log(`  3. ${room3.id}`);
  } catch (error) {
    console.error('❌ Error creating rooms:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

create30MinRooms()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

