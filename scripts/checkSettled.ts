import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSettled() {
  const rooms = await prisma.room.findMany({
    where: {
      status: 'SETTLED'
    },
    include: {
      bets: {
        include: {
          user: true
        }
      }
    },
    orderBy: { settledAt: 'desc' },
    take: 5
  });

  console.log(`\n✅ Found ${rooms.length} settled room(s)\n`);
  
  for (const room of rooms) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Room: ${room.title}`);
    console.log(`Status: ${room.status}`);
    console.log(`Winner: ${room.winningSide}`);
    console.log(`Settled At: ${room.settledAt}`);
    console.log(`Total Pool: ${room.pool.toNumber()} SOL`);
    console.log(`YES Pool: ${room.longPool.toNumber()} SOL`);
    console.log(`NO Pool: ${room.shortPool.toNumber()} SOL`);
    console.log(`\nBets:`);
    
    for (const bet of room.bets) {
      const won = bet.won ? '✅ WON' : '❌ LOST';
      const payout = bet.payout ? `→ ${bet.payout.toNumber()} SOL` : '';
      console.log(`  - User ${bet.user.telegramId}: ${bet.side} ${bet.amount.toNumber()} SOL ${won} ${payout}`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

checkSettled();



