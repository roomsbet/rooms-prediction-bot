/**
 * Update room titles to remove contract addresses
 * Contract addresses remain in tokenAddress field for oracle queries
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateRoomTitles() {
  try {
    // Update Room 1: MONEROCHAN
    const room1 = await prisma.room.findFirst({
      where: {
        tokenAddress: 'H5b4iYiZYycr7fmQ1dMj7hdfLGAEPcDH261K4hugpump',
      },
    });

    if (room1) {
      await prisma.room.update({
        where: { id: room1.id },
        data: {
          title: 'Will $MONEROCHAN hit 3m market cap in the next hour',
        },
      });
      console.log(`✅ Updated Room 1: ${room1.id}`);
    }

    // Update Room 3: SPSN
    const room3 = await prisma.room.findFirst({
      where: {
        tokenAddress: 'Sg4k4iFaEeqhv5866cQmsFTMhRx8sVCPAq2j8Xcpump',
        title: {
          contains: 'SPSN',
        },
      },
    });

    if (room3) {
      await prisma.room.update({
        where: { id: room3.id },
        data: {
          title: 'Will $SPSN hit 4m market cap in the next hour?',
        },
      });
      console.log(`✅ Updated Room 3: ${room3.id}`);
    }

    // Room 2 (SOL price) doesn't need updating - no contract address in title

    console.log('\n✅ All room titles updated!');
    console.log('Contract addresses remain in tokenAddress field for oracle queries.');
  } catch (error) {
    console.error('❌ Error updating room titles:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateRoomTitles()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

