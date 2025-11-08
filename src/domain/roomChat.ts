/**
 * Room Chat Domain - Helper functions for room chat commands
 */

import { prisma } from '../infra/db';

/**
 * Check if user is a participant (has ACTIVE bet) in a room
 */
export async function isParticipant(tgId: number, roomId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(tgId) },
  });

  if (!user) {
    return false;
  }

  const bet = await prisma.bet.findFirst({
    where: {
      userId: user.id,
      roomId: roomId,
      status: 'ACTIVE',
    },
  });

  return !!bet;
}

/**
 * Get room by chat ID
 */
export async function roomFromChat(chatId: string) {
  const room = await prisma.room.findFirst({
    where: { chatId: chatId },
    include: {
      bets: {
        where: { status: 'ACTIVE' },
        include: {
          user: true,
        },
      },
    },
  });

  return room;
}

/**
 * Get pool breakdown with percentages
 */
export async function poolBreakdown(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    return null;
  }

  const totalPool = room.pool.toNumber();
  const yesPool = room.longPool.toNumber();
  const noPool = room.shortPool.toNumber();

  const yesPercent = totalPool > 0 ? ((yesPool / totalPool) * 100).toFixed(1) : '0.0';
  const noPercent = totalPool > 0 ? ((noPool / totalPool) * 100).toFixed(1) : '0.0';

  return {
    total: totalPool,
    yes: yesPool,
    no: noPool,
    yesPercent,
    noPercent,
  };
}

/**
 * Get oracle price (stub - returns mock data)
 */
export async function getOraclePrice(feedId: string): Promise<number> {
  // Stub: return mock price
  // In production, integrate with Switchboard/Pyth
  if (feedId.includes('SOL') || feedId.includes('sol')) {
    return 159.42 + (Math.random() - 0.5) * 2; // Mock fluctuation around $159.42
  }
  return 100.0;
}

/**
 * Place bet from chat
 */
export async function placeBetFromChat(
  telegramId: number,
  roomId: string,
  amount: number,
  side: 'YES' | 'NO'
) {
  const { joinRoom } = await import('./room');
  return await joinRoom(telegramId, roomId, side, amount);
}

/**
 * Get participants list grouped by side
 */
export async function getParticipantsList(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      bets: {
        where: { status: 'ACTIVE' },
        include: {
          user: true,
        },
      },
    },
  });

  if (!room) {
    return { yes: [], no: [] };
  }

  const yesBets = room.bets.filter(b => b.side === 'YES');
  const noBets = room.bets.filter(b => b.side === 'NO');

  const yesList = yesBets.map(bet => ({
    username: bet.user.username || `user${bet.user.telegramId}`,
    amount: bet.amount.toNumber(),
  }));

  const noList = noBets.map(bet => ({
    username: bet.user.username || `user${bet.user.telegramId}`,
    amount: bet.amount.toNumber(),
  }));

  return { yes: yesList, no: noList };
}

/**
 * Get full room stats
 */
export async function getRoomStats(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    return null;
  }

  const breakdown = await poolBreakdown(roomId);
  if (!breakdown) {
    return null;
  }

  return {
    title: room.title,
    oracleFeed: room.oracleFeed,
    cap: room.cap,
    minBet: room.minBet.toNumber(),
    maxBet: room.maxBet?.toNumber(),
    pool: breakdown.total,
    yesPool: breakdown.yes,
    noPool: breakdown.no,
    yesPercent: breakdown.yesPercent,
    noPercent: breakdown.noPercent,
    settleTime: room.settleTime,
  };
}

/**
 * Get random taunt message
 */
export function getRandomTaunt(): string {
  const taunts = [
    "Your conviction is paper thin.",
    "Charts fear me.",
    "NGMI energy detected.",
    "Weak hands gonna weak hand.",
    "This is financial advice: YOLO",
    "Diamond hands or paper hands?",
    "The oracle doesn't lie.",
    "Time to show your cards.",
    "Confidence level: 📈 or 📉?",
    "Betting against me? Bold move.",
    "The market will decide.",
    "May the best prediction win.",
    "No cap, just facts.",
    "This is the way.",
    "Trust the process.",
  ];

  return taunts[Math.floor(Math.random() * taunts.length)];
}

