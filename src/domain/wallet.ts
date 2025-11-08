/**
 * Wallet Domain - Business logic for wallet operations
 */

import { prisma } from '../infra/db';
import { generateKeypair } from '../infra/solana';
import { encryptKey, decryptKey } from '../infra/kms';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Create a new wallet for a user
 */
export async function createWallet(telegramId: number, username?: string) {
  // Generate new Solana keypair
  const keypair = generateKeypair();
  const publicKey = keypair.publicKey.toString();
  const secretKey = keypair.secretKey;

  // Encrypt the private key
  const encryptedKey = await encryptKey(secretKey);

  // Generate referral code
  const referralCode = generateReferralCode();

  // Create user in database
  const user = await prisma.user.create({
    data: {
      telegramId: BigInt(telegramId),
      username: username || undefined,
      walletAddress: publicKey,
      encryptedKey,
      referralCode,
    },
  });

  return user;
}

/**
 * Get or create user by Telegram ID
 */
export async function getOrCreateUser(telegramId: number, username?: string) {
  let user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!user) {
    user = await createWallet(telegramId, username);
  }

  return user;
}

/**
 * Get user balance
 */
export async function getBalance(telegramId: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!user) {
    return 0;
  }

  return user.balance.toNumber();
}

/**
 * Deposit SOL to user wallet
 * In production, this would be triggered by monitoring blockchain transactions
 */
export async function deposit(telegramId: number, amount: number, txSignature: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Update user balance
  await prisma.user.update({
    where: { id: user.id },
    data: {
      balance: { increment: new Decimal(amount) },
      totalDeposited: { increment: new Decimal(amount) },
    },
  });

  // Record transaction
  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: 'DEPOSIT',
      amount: new Decimal(amount),
      txSignature,
      status: 'CONFIRMED',
    },
  });

  return true;
}

/**
 * Withdraw SOL from user wallet
 * STUB: In production, this would create and sign a Solana transaction
 */
export async function withdraw(telegramId: number, destinationAddress: string, amount: number) {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const balance = user.balance.toNumber();
  if (balance < amount) {
    throw new Error('Insufficient balance');
  }

  // STUB: In production, decrypt key and send transaction
  console.log('STUB: Would send transaction to', destinationAddress, 'for', amount, 'SOL');

  // Update user balance
  await prisma.user.update({
    where: { id: user.id },
    data: {
      balance: { decrement: new Decimal(amount) },
      totalWithdrawn: { increment: new Decimal(amount) },
    },
  });

  // Record transaction
  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: 'WITHDRAW',
      amount: new Decimal(amount),
      txSignature: 'STUB_TX_' + Date.now(),
      status: 'CONFIRMED',
      metadata: { destination: destinationAddress },
    },
  });

  return tx.txSignature;
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(telegramId: number, page: number = 0, limit: number = 10) {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });

  if (!user) {
    return [];
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    skip: page * limit,
    take: limit,
  });

  return transactions.map(tx => ({
    type: tx.type,
    amount: tx.amount.toNumber(),
    timestamp: tx.createdAt,
    signature: tx.txSignature || undefined,
  }));
}

/**
 * Generate a unique referral code
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

