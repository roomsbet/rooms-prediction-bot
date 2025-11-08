/**
 * Script to create 3 test rooms:
 * 1. MONEROCHAN pumpfun market (3m mcap, 1 hour)
 * 2. SOL price market ($155, 30 minutes)
 * 3. SPSN pumpfun market (4m mcap, 1 hour)
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function createTestRooms() {
  try {
    const now = new Date();

    // Room 1: MONEROCHAN - 3m market cap in 1 hour
    const room1SettleTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const room1LockTime = new Date(room1SettleTime.getTime() - 5 * 60 * 1000); // 5 min before settle

    const room1 = await prisma.room.create({
      data: {
        title: 'Will $MONEROCHAN [H5b4iYiZYycr7fmQ1dMj7hdfLGAEPcDH261K4hugpump] hit 3m market cap in the next hour',
        oracleFeed: 'MONEROCHAN/USD',
        status: 'OPEN',
        marketType: 'pumpfun_mcap',
        tokenAddress: 'H5b4iYiZYycr7fmQ1dMj7hdfLGAEPcDH261K4hugpump',
        tokenSymbol: 'MONEROCHAN',
        targetValue: new Decimal(3_000_000), // 3m market cap
        targetDate: room1SettleTime,
        cap: 5,
        minBet: new Decimal(0.10),
        maxBet: new Decimal(5.00),
        lockTime: room1LockTime,
        settleTime: room1SettleTime,
      },
    });

    console.log(`✅ Created Room 1: ${room1.title}`);
    console.log(`   Settles at: ${room1SettleTime.toLocaleString()}`);

    // Room 2: SOL Price - $155 in 30 minutes
    const room2SettleTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
    const room2LockTime = new Date(room2SettleTime.getTime() - 5 * 60 * 1000); // 5 min before settle

    const room2 = await prisma.room.create({
      data: {
        title: 'Will SOL price reach 155$ in the next 30 minutes',
        oracleFeed: 'SOL/USD',
        status: 'OPEN',
        marketType: 'sol_price',
        targetValue: new Decimal(155),
        targetDate: room2SettleTime,
        cap: 5,
        minBet: new Decimal(0.10),
        maxBet: new Decimal(5.00),
        lockTime: room2LockTime,
        settleTime: room2SettleTime,
      },
    });

    console.log(`✅ Created Room 2: ${room2.title}`);
    console.log(`   Settles at: ${room2SettleTime.toLocaleString()}`);

    // Room 3: SPSN - 4m market cap in 1 hour
    const room3SettleTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const room3LockTime = new Date(room3SettleTime.getTime() - 5 * 60 * 1000); // 5 min before settle

    const room3 = await prisma.room.create({
      data: {
        title: 'Will $SPSN [Sg4k4iFaEeqhv5866cQmsFTMhRx8sVCPAq2j8Xcpump] hit 4m market cap in the next hour?',
        oracleFeed: 'SPSN/USD',
        status: 'OPEN',
        marketType: 'pumpfun_mcap',
        tokenAddress: 'Sg4k4iFaEeqhv5866cQmsFTMhRx8sVCPAq2j8Xcpump',
        tokenSymbol: 'SPSN',
        targetValue: new Decimal(4_000_000), // 4m market cap
        targetDate: room3SettleTime,
        cap: 5,
        minBet: new Decimal(0.10),
        maxBet: new Decimal(5.00),
        lockTime: room3LockTime,
        settleTime: room3SettleTime,
      },
    });

    console.log(`✅ Created Room 3: ${room3.title}`);
    console.log(`   Settles at: ${room3SettleTime.toLocaleString()}`);

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

createTestRooms()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

