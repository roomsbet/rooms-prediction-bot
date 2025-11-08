/**
 * Script to send 5 testnet SOL to an address
 * Usage: SENDER_PRIVATE_KEY=<base58_key> npx tsx scripts/sendTestnetSol.ts
 * Or: npx tsx scripts/sendTestnetSol.ts (will prompt for key)
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import * as readline from 'readline';

const TARGET_ADDRESS = '5Be3kRGHfgBq6d3NSwR3b4GEqvSARTDznKy969S3FGNQ';
const AMOUNT_SOL = 5;

// Use devnet for testnet
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

async function getPrivateKey(): Promise<Uint8Array | null> {
  // Try environment variable first
  const envKey = process.env.SENDER_PRIVATE_KEY;
  if (envKey && envKey !== 'your_key_here') {
    try {
      // Try base58 first
      return bs58.decode(envKey);
    } catch {
      try {
        // Try hex
        return new Uint8Array(Buffer.from(envKey, 'hex'));
      } catch {
        console.error('❌ Invalid SENDER_PRIVATE_KEY format');
        return null;
      }
    }
  }

  // No key provided - return null to use airdrop
  return null;
}

async function sendSol() {
  try {
    console.log(`🚀 Sending ${AMOUNT_SOL} testnet SOL to ${TARGET_ADDRESS}...`);
    console.log(`📡 Using RPC: ${RPC_URL}\n`);

    // Connect to devnet
    const connection = new Connection(RPC_URL, 'confirmed');

    // Get sender keypair
    console.log('🔑 Loading sender keypair...');
    const privateKey = await getPrivateKey();
    
    let senderKeypair: Keypair;
    if (privateKey) {
      senderKeypair = Keypair.fromSecretKey(privateKey);
    } else {
      // Generate new keypair for airdrop
      console.log('📝 No sender key provided, generating new keypair...');
      senderKeypair = Keypair.generate();
      console.log(`✅ Generated new keypair: ${senderKeypair.publicKey.toString()}`);
    }
    
    const senderAddress = senderKeypair.publicKey.toString();
    console.log(`✅ Sender: ${senderAddress}`);

    // Check sender balance
    const senderBalance = await connection.getBalance(senderKeypair.publicKey);
    const senderBalanceSol = senderBalance / LAMPORTS_PER_SOL;
    console.log(`💰 Sender balance: ${senderBalanceSol.toFixed(4)} SOL`);

    if (senderBalanceSol < AMOUNT_SOL + 0.001) {
      console.log(`\n⚠️  Insufficient balance! Need at least ${AMOUNT_SOL + 0.001} SOL (including fees)`);
      console.log(`💡 Requesting airdrop...`);
      
      try {
        const airdropAmount = (AMOUNT_SOL + 1) * LAMPORTS_PER_SOL;
        const airdropSignature = await connection.requestAirdrop(
          senderKeypair.publicKey,
          airdropAmount
        );
        console.log(`📝 Airdrop signature: ${airdropSignature}`);
        console.log(`⏳ Waiting for confirmation...`);
        
        // Wait for confirmation with retries
        let confirmed = false;
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          const status = await connection.getSignatureStatus(airdropSignature);
          if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
            confirmed = true;
            break;
          }
          console.log(`   Attempt ${i + 1}/10...`);
        }
        
        if (!confirmed) {
          throw new Error('Airdrop confirmation timeout');
        }
        
        const newBalance = await connection.getBalance(senderKeypair.publicKey);
        console.log(`✅ Airdrop confirmed!`);
        console.log(`💰 New balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
        
        if (newBalance < airdropAmount * 0.9) {
          throw new Error('Airdrop amount mismatch');
        }
      } catch (airdropError: any) {
        console.error('❌ Airdrop failed:', airdropError.message);
        console.error('\n💡 Tip: Provide a funded wallet via SENDER_PRIVATE_KEY env var');
        throw new Error('Cannot proceed without sufficient balance');
      }
    }

    // Create transaction
    const targetPublicKey = new PublicKey(TARGET_ADDRESS);
    const amountLamports = AMOUNT_SOL * LAMPORTS_PER_SOL;

    console.log(`📤 Creating transaction...`);
    console.log(`   To: ${TARGET_ADDRESS}`);
    console.log(`   Amount: ${AMOUNT_SOL} SOL (${amountLamports} lamports)\n`);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: targetPublicKey,
        lamports: amountLamports,
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderKeypair.publicKey;

    // Sign and send
    console.log('✍️  Signing transaction...');
    transaction.sign(senderKeypair);

    console.log('📡 Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [senderKeypair],
      {
        commitment: 'confirmed',
        skipPreflight: false,
      }
    );

    console.log(`\n✅ Transaction successful!`);
    console.log(`📝 Signature: ${signature}`);
    console.log(`🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Verify balance
    const targetBalance = await connection.getBalance(targetPublicKey);
    console.log(`\n💰 Target balance: ${(targetBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
    process.exit(1);
  }
}

sendSol()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

