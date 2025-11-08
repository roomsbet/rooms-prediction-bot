/**
 * Deposit Monitor Service - Helius Webhook Handler
 * Listens for incoming SOL transfers and credits user balances
 */

import express from 'express';
import { deposit } from '../domain/wallet';
import { prisma } from '../infra/db';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const app = express();
app.use(express.json());

interface HeliusTransaction {
  signature: string;
  type: string;
  timestamp: number;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
}

/**
 * Helius webhook endpoint
 */
app.post('/helius/webhook', async (req, res) => {
  try {
    console.log('📨 Helius webhook received:', JSON.stringify(req.body, null, 2));
    
    const events: HeliusTransaction[] = Array.isArray(req.body) ? req.body : [req.body];
    
    for (const event of events) {
      // Check if this is a transfer event
      if (event.nativeTransfers && event.nativeTransfers.length > 0) {
        for (const transfer of event.nativeTransfers) {
          const { toUserAccount, amount } = transfer;
          
          // Find user by wallet address
          const user = await prisma.user.findUnique({
            where: { walletAddress: toUserAccount }
          });
          
          if (user) {
            const solAmount = amount / LAMPORTS_PER_SOL;
            
            console.log(`💰 Deposit detected: ${solAmount} SOL to user ${user.telegramId}`);
            
            // Credit user balance
            await deposit(
              Number(user.telegramId),
              solAmount,
              event.signature
            );
            
            console.log(`✅ Balance credited: ${solAmount} SOL to user ${user.telegramId}`);
            
            // TODO: Notify user via Telegram about successful deposit
            // This will be implemented in the next phase
          } else {
            console.log(`⚠️  Transfer to unknown wallet: ${toUserAccount}`);
          }
        }
      }
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'deposit-monitor' });
});

/**
 * Start the deposit monitor webhook server
 */
export function startDepositMonitor(port: number = 3000) {
  const server = app.listen(port, () => {
    console.log(`🎧 Deposit monitor listening on port ${port}`);
    console.log(`📡 Webhook endpoint: http://localhost:${port}/helius/webhook`);
  });
  
  return server;
}

/**
 * Stop the deposit monitor
 */
let serverInstance: any = null;

export function stopDepositMonitor() {
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('✅ Deposit monitor stopped');
    });
    serverInstance = null;
  }
}


