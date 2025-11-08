/**
 * Referrals Messages - Message templates for referral system
 */

export interface ReferralData {
  referralCode: string;
  referredCount: number;
  totalRewards: number;
}

export function formatReferralsMessage(data: ReferralData, referralLink: string): string {
  return `👥 *Referral Program*

*Your Referral Link:*
[${referralLink}](${referralLink})

*Stats:*
• Referred Users: ${data.referredCount}
• Total Rewards: ${data.totalRewards.toFixed(4)} SOL

━━━━━━━━━━━━━━━━━━

*How it works:*
1. Share your referral link
2. When friends sign up and bet, you earn rewards
3. Rewards are credited instantly to your balance

*Reward Structure:*
• 5% of protocol fees from referred users
• Lifetime earnings (no expiration)

_Share your link below to start earning!_`;
}

export function formatRulesMessage(): string {
  return `📜 *ROOMS Rules*

*How to Play:*
1. Deposit SOL to your wallet
2. Browse available rooms
3. Choose YES or NO
4. Place your bet before lock time
5. Wait for settlement
6. Winners receive payouts automatically

*Betting:*
• Minimum bet varies per room
• Maximum bet varies per room
• Room capacity: 2-10 players
• Bets cannot be cancelled once placed
• Only one bet per room per user

*Fees:*
• 3% total fee on pool (2% protocol, 1% host)
• Fees deducted before payout distribution
• No deposit/withdrawal fees (network fees apply)

*Settlement:*
• Rooms lock at lock time (betting closes)
• Final price checked at settle time
• If condition is met: YES wins
• If condition is not met: NO wins
• Payouts distributed proportionally to winners

*Winnings:*
• Winners receive share based on bet size
• Payouts credited instantly to balance
• View your wins in "🏆 Rooms Won"

*Security:*
• Your wallet is encrypted and secure
• Private keys never shared
• All transactions on Solana blockchain
• You control your funds

━━━━━━━━━━━━━━━━━━

_Ready to bet? Enter a room and make your prediction!_`;
}

