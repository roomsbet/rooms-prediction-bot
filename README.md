# ROOMS - Next-Gen Prediction Markets

**The only prediction market that actually cares about its users.**

ROOMS is a blazing-fast Telegram bot that lets you bet on real-time crypto price movements with instant settlements, push notifications, and zero complexity. Built on Solana for speed and powered by multiple oracle feeds for accuracy.

> Place your bets. Get instant results. Win real SOL. All inside Telegram.

## Features

### For Players
- **Instant Settlements** - Oracle monitors markets 24/7 and settles rooms the moment targets are hit
- **Push Notifications** - Get notified instantly when you win or lose with personalized payout details
- **Beautiful UI** - Smooth inline keyboard experience with no page refreshes or clunky navigation
- **Create Your Own Rooms** - Users can launch custom prediction markets in seconds
- **Any Coin, Any Target** - Bet on SOL, Bitcoin, Ethereum, Pump.fun tokens, or any cryptocurrency
- **Referral Rewards** - Earn from every bet your referrals place

### Technical Excellence
- **Real-time Price Feeds** - Multi-source oracle system (CryptoCompare, Binance, CoinGecko, DexScreener)
- **Instant Oracle Resolution** - 3-second polling for Pump.fun tokens and live price tracking
- **Custodial Wallets** - Seamless SOL wallet creation inside Telegram
- **Transaction Safety** - Duplicate bet prevention and atomic database operations
- **User Attribution** - Every room shows who created it with automatic @username linking

## Requirements

- Node.js 20+
- PostgreSQL database
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Solana RPC endpoint (Helius recommended)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your values:

```bash
cp env.example .env
```

Required environment variables:

- `TG_BOT_TOKEN` - Your Telegram bot token from @BotFather
- `DATABASE_URL` - PostgreSQL connection string
- `SOLANA_RPC_URL` - Helius or other Solana RPC endpoint
- `SOLANA_NETWORK` - mainnet-beta, devnet, or testnet

### 3. Setup Database

Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Run the Bot

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## Project Structure

```
ROOMS PROJ/
├── src/
│   ├── index.ts              # Main bot entry point
│   ├── handlers/             # Command and callback handlers
│   │   ├── start.ts          # /start command and dashboard
│   │   ├── wallet.ts         # Wallet operations
│   │   ├── rooms.ts          # Room browsing and joining
│   │   ├── bets.ts           # Bet tracking
│   │   └── referrals.ts      # Referral system
│   ├── keyboards/            # Inline keyboard definitions
│   │   ├── dashboard.ts
│   │   ├── wallet.ts
│   │   ├── rooms.ts
│   │   ├── bets.ts
│   │   └── referrals.ts
│   ├── messages/             # Message templates (Markdown)
│   │   ├── dashboard.ts
│   │   ├── wallet.ts
│   │   ├── rooms.ts
│   │   ├── bets.ts
│   │   └── referrals.ts
│   ├── domain/               # Business logic layer
│   │   ├── wallet.ts         # Wallet operations
│   │   ├── room.ts           # Room management
│   │   ├── oracle.ts         # Price feeds
│   │   └── referral.ts       # Referral logic
│   └── infra/                # Infrastructure layer
│       ├── db.ts             # Prisma client
│       ├── solana.ts         # Solana connection
│       ├── kms.ts            # Key management (Turnkey)
│       └── price.ts          # Price feed utilities
├── prisma/
│   └── schema.prisma         # Database schema
├── package.json
├── tsconfig.json
└── README.md
```

## Usage

### For Users

1. Start the bot: Send `/start` to your bot
2. Deposit SOL: Use the Wallet → Deposit flow
3. Browse rooms: Click "🟢 Enter Available Rooms"
4. Place bets: Select a room, choose LONG or SHORT, confirm
5. Win SOL: Payouts are automatic after settlement

### Dashboard Commands

- **Wallet** - View balance, deposit, withdraw
- **My Bets** - Track active and historical bets
- **Referrals** - View your referral code and earnings
- **Rooms Won** - See your winning history
- **Recent Rooms** - View rooms you've participated in
- **Rules** - Learn how ROOMS works
- **Refresh** - Update dashboard stats

## Configuration

### Fees

Default fee structure (configurable in `.env`):
- Protocol fee: 2%
- Host fee: 1%
- Total: 3% on winnings

### Betting Limits

- Minimum bet: 0.05 SOL (configurable)
- Room capacity: 5-10 players
- Withdrawal cooldown: 10 minutes

### Room Lifecycle

1. **OPEN**: Users can join and place bets
2. **LOCKED**: Betting closed, oracle price captured
3. **SETTLED**: Winners determined, payouts distributed
4. **ARCHIVED**: Historical record

## Security

### Key Management

- Private keys encrypted via KMS (Turnkey integration recommended)
- Placeholder encryption for development (⚠️ NOT secure for production)
- Hot/cold wallet split recommended for production

### Best Practices

- Never expose private keys
- Use environment variables for sensitive data
- Enable withdrawal confirmations
- Implement rate limiting in production
- Monitor for suspicious activity

## Database Schema

Main models:
- **User**: Telegram users with wallets
- **Room**: Prediction market rooms
- **Bet**: User bets on rooms
- **Transaction**: Financial ledger
- **Referral**: Referral tracking

See `prisma/schema.prisma` for complete schema.

## Development

### Database Management

```bash
# Generate Prisma client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Open Prisma Studio (GUI)
npm run prisma:studio
```

### Useful Commands

```bash
# Watch mode (hot reload)
npm run dev

# Build TypeScript
npm run build

# Run production
npm start
```

## TODO / Roadmap

- [ ] Integrate real Turnkey KMS for key encryption
- [ ] Implement Pyth/Switchboard oracle integration
- [ ] Add withdrawal confirmation codes (OTP)
- [ ] Implement deposit monitoring (blockchain listener)
- [ ] Add admin panel for room creation
- [ ] Implement automatic room settlement scheduler
- [ ] Add leaderboard functionality
- [ ] Implement referral rewards automation
- [ ] Add room templates for quick creation
- [ ] Implement multi-asset support (BTC/USD, ETH/USD, etc.)

## License

MIT License - see LICENSE file for details

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

- Documentation: https://docs.rooms.gg
- Twitter: https://x.com/rooms
- Community: https://t.me/roomsportal

---

Built with TypeScript, Telegraf, and Solana

