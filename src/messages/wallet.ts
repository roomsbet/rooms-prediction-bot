/**
 * Wallet Messages - Message templates for wallet operations
 */

import { shortAddress } from '../infra/solana';
import { formatUsd } from '../infra/price';

export interface WalletData {
  address: string;
  balance: number;
  usdValue: number;
  totalDeposited: number;
  totalWithdrawn: number;
  availableForBets: number;
}

export function formatWalletMessage(data: WalletData): string {
  return `💼 *Your Wallet*

*Address:* \`${data.address}\`

*Balance:* ${data.balance.toFixed(4)} SOL (${formatUsd(data.usdValue)})

━━━━━━━━━━━━━━━━━━

_Choose an action below:_`;
}

export function formatDepositMessage(address: string): string {
  return `💰 *Deposit SOL*

Send SOL to this address:

\`${address}\`

⚠️ *Important:*
• Minimum deposit: ${process.env.MIN_BET_SOL || '0.05'} SOL
• Only send SOL (Solana network)
• Funds will be credited after 1 confirmation
• Do not send from exchanges directly

Your balance will update automatically once the transaction is confirmed.`;
}

export function formatWithdrawMessage(): string {
  return `💸 *Withdraw SOL*

Start by setting your destination wallet address.

⚠️ *Important:*
• Double-check the address before confirming
• Only send to Solana addresses
• Minimum withdrawal: 0.01 SOL
• Network fees apply (~0.000005 SOL)`;
}

export function formatWithdrawAmountMessage(balance: number, destinationAddress: string): string {
  return `💸 *Withdraw SOL*

*Destination:* \`${destinationAddress}\`

*Available Balance:* ${balance.toFixed(4)} SOL

Enter the amount to withdraw, or use the 100% button to withdraw all funds.`;
}

export interface TransactionItem {
  type: string;
  amount: number;
  timestamp: Date;
  signature?: string;
}

export function formatTransactionHistory(transactions: TransactionItem[], page: number): string {
  if (transactions.length === 0) {
    return `📊 *Transaction History*

No transactions yet.

_Start by depositing SOL to your wallet!_`;
  }

  let message = `📊 *Transaction History* (Page ${page + 1})\n\n`;
  
  transactions.forEach(tx => {
    const emoji = getTransactionEmoji(tx.type);
    const sign = tx.type === 'DEPOSIT' || tx.type === 'WIN' ? '+' : '-';
    message += `${emoji} *${tx.type}*\n`;
    message += `   ${sign}${Math.abs(tx.amount).toFixed(4)} SOL\n`;
    message += `   _${tx.timestamp.toLocaleString()}_\n`;
    if (tx.signature) {
      message += `   \`${tx.signature.slice(0, 8)}...\`\n`;
    }
    message += `\n`;
  });
  
  return message;
}

function getTransactionEmoji(type: string): string {
  const emojiMap: { [key: string]: string } = {
    DEPOSIT: '📥',
    WITHDRAW: '📤',
    BET: '🎲',
    WIN: '🏆',
    FEE: '💸',
    REFERRAL_REWARD: '🎁'
  };
  return emojiMap[type] || '📝';
}

