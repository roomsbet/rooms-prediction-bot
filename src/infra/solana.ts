/**
 * Solana Infrastructure - RPC Connection and Keypair Management
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Helius RPC connection
export function createSolanaConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

export const solanaConnection = createSolanaConnection();

/**
 * Generate a new Solana keypair for user wallet
 * In production, this should be encrypted via KMS before storing
 */
export function generateKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Restore keypair from decrypted secret key bytes
 * @param secretKey - Uint8Array of secret key (64 bytes)
 */
export function restoreKeypair(secretKey: Uint8Array): Keypair {
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Get SOL balance for a wallet address
 */
export async function getBalance(address: string): Promise<number> {
  try {
    const publicKey = new PublicKey(address);
    const balance = await solanaConnection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error fetching balance:', error);
    return 0;
  }
}

/**
 * Shorten wallet address for display
 * e.g., "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" -> "7xKX...gAsU"
 */
export function shortAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

