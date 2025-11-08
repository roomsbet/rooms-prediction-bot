import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRoom1() {
  // Find the old room
  const room = await prisma.room.findFirst({
    where: {
      title: {
        contains: '2m market cap'
      }
    }
  });

  if (!room) {
    console.log('Room not found');
    return;
  }

  console.log('Found room:', room.title);
  console.log('Current marketType:', room.marketType);

  // Update it with proper market type and target
  await prisma.room.update({
    where: { id: room.id },
    data: {
      marketType: 'pumpfun_mcap',
      targetValue: 2000000, // 2M
      targetDate: new Date('2025-11-05T23:59:59'),
      tokenAddress: 'Sg4k4iFaEeqhv5866cQmsFTMhRx8sVCPAq2j8Xcpump',
      tokenSymbol: '$SPSN',
    }
  });

  console.log('✅ Updated room with market type and target!');
  
  await prisma.$disconnect();
}

fixRoom1();



