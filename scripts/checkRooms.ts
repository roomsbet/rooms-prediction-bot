import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRooms() {
  const rooms = await prisma.room.findMany({
    where: {
      status: { in: ['QUEUING', 'OPEN', 'LOCKED'] }
    },
    select: {
      id: true,
      title: true,
      status: true,
      lockTime: true,
      settleTime: true,
      marketType: true,
      targetValue: true,
      tokenAddress: true,
      tokenSymbol: true,
    }
  });

  console.log('\n📊 Current Rooms:\n');
  const now = new Date();
  
  for (const room of rooms) {
    console.log(`Room: ${room.title}`);
    console.log(`Status: ${room.status}`);
    console.log(`Market Type: ${room.marketType}`);
    console.log(`Target Value: ${room.targetValue}`);
    console.log(`Token: ${room.tokenSymbol} (${room.tokenAddress})`);
    console.log(`Lock Time: ${room.lockTime}`);
    console.log(`Settle Time: ${room.settleTime}`);
    console.log(`Time to lock: ${Math.floor((room.lockTime.getTime() - now.getTime()) / 1000)}s`);
    console.log(`Time to settle: ${Math.floor((room.settleTime.getTime() - now.getTime()) / 1000)}s`);
    console.log('---');
  }

  await prisma.$disconnect();
}

checkRooms();



