/**
 * Referral Domain - Referral system logic
 */

import { prisma } from '../infra/db';

/**
 * Get referral stats for a user
 */
export async function getReferralStats(telegramId: number) {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: {
      referralsGiven: {
        include: {
          referred: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const totalRewards = user.referralsGiven.reduce(
    (sum, ref) => sum + ref.rewardsEarned.toNumber(),
    0
  );

  return {
    referralCode: user.referralCode,
    referredCount: user.referralsGiven.length,
    totalRewards,
  };
}

/**
 * Track a referral when a new user signs up
 */
export async function trackReferral(newUserTelegramId: number, referralCode: string) {
  // Find referrer by code
  const referrer = await prisma.user.findUnique({
    where: { referralCode },
  });

  if (!referrer) {
    console.warn(`Referral code not found: ${referralCode}`);
    return false;
  }

  // Find new user
  const newUser = await prisma.user.findUnique({
    where: { telegramId: BigInt(newUserTelegramId) },
  });

  if (!newUser) {
    throw new Error('New user not found');
  }

  // Don't allow self-referral
  if (referrer.id === newUser.id) {
    return false;
  }

  // Check if referral already exists
  const existing = await prisma.referral.findUnique({
    where: {
      referrerId_referredId: {
        referrerId: referrer.id,
        referredId: newUser.id,
      },
    },
  });

  if (existing) {
    return false;
  }

  // Create referral
  await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      referredId: newUser.id,
    },
  });

  // Update new user's referredBy
  await prisma.user.update({
    where: { id: newUser.id },
    data: {
      referredBy: referralCode,
    },
  });

  return true;
}

/**
 * Process referral reward when referred user wins
 * Called after a bet is settled as a win
 */
export async function processReferralReward(userId: string, amount: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.referredBy) {
    return; // No referrer
  }

  // Find referrer
  const referrer = await prisma.user.findUnique({
    where: { referralCode: user.referredBy },
  });

  if (!referrer) {
    return;
  }

  // Calculate reward (5% of protocol fees)
  const protocolFeeRate = 0.02; // 2% protocol fee
  const referralRate = 0.05; // 5% of protocol fees
  const reward = amount * protocolFeeRate * referralRate;

  if (reward <= 0) {
    return;
  }

  // Credit referrer
  await prisma.$transaction(async (tx) => {
    // Update referrer balance
    await tx.user.update({
      where: { id: referrer.id },
      data: {
        balance: { increment: reward },
      },
    });

    // Update referral record
    await tx.referral.updateMany({
      where: {
        referrerId: referrer.id,
        referredId: user.id,
      },
      data: {
        rewardsEarned: { increment: reward },
      },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId: referrer.id,
        type: 'REFERRAL_REWARD',
        amount: reward,
        status: 'CONFIRMED',
        metadata: { referredUserId: user.id },
      },
    });
  });
}

