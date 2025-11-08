# API Reference

## Bot Commands

### `/start`
Opens the main dashboard.

**Response:** Dashboard with wallet balance, stats, and navigation.

### `/wallet`
Opens wallet interface.

**Response:** Wallet balance, deposit address, transaction history.

### `/bets`
Shows your active and historical bets.

**Response:** List of bets with status, amounts, and results.

### `/referrals`
Shows referral program stats.

**Response:** Referral link, stats, and earnings.

### `/won`
Shows rooms you've won.

**Response:** Winning history with profit calculations.

### `/rooms`
Browses available rooms.

**Response:** List of active prediction markets.

### `/create`
Starts room creation flow.

**Response:** Room creation interface.

### `/rules`
Shows game rules and guidelines.

**Response:** Complete rules documentation.

## Callback Actions

### Dashboard
- `cb:refresh` - Refresh dashboard
- `cb:back_dashboard` - Return to dashboard
- `cb:enter_rooms` - Browse rooms
- `cb:wallet` - Open wallet
- `cb:my_bets` - View bets
- `cb:referrals` - View referrals
- `cb:rooms_won` - View wins
- `cb:recent_rooms` - Recent activity
- `cb:rules` - View rules

### Wallet
- `cb:deposit` - Show deposit address
- `cb:withdraw` - Start withdrawal
- `cb:wallet_history` - Transaction history

### Rooms
- `cb:room:{id}` - View room details
- `cb:join_room:{id}:{side}` - Join room (YES/NO)
- `cb:confirm_bet:{id}:{side}:{amount}` - Confirm bet
- `cb:create_room` - Create new room

## Data Models

### User
```typescript
{
  id: string
  telegramId: bigint
  username?: string
  walletAddress: string
  balance: Decimal
  createdAt: Date
}
```

### Room
```typescript
{
  id: string
  title: string
  status: 'OPEN' | 'LOCKED' | 'SETTLED'
  marketType: string
  pool: Decimal
  longPool: Decimal
  shortPool: Decimal
  settleTime: Date
}
```

### Bet
```typescript
{
  id: string
  userId: string
  roomId: string
  side: 'YES' | 'NO'
  amount: Decimal
  payout?: Decimal
  won?: boolean
  status: 'ACTIVE' | 'SETTLED'
}
```

---

_Trusted by Helius • Powered by Turnkey • Built on Solana_

