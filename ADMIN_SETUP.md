# ROOMS Admin Dashboard Setup

## Quick Start

### 1. Add Your Telegram ID

To get admin access, you need to add your Telegram user ID to the config:

**Get your Telegram ID:**
1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It will reply with your user ID (e.g., `123456789`)

**Add it to the config:**
Edit `src/config/admin.ts` and add your ID:

```typescript
export const ADMIN_IDS: number[] = [
  123456789,  // Replace with your actual ID
];
```

### 2. Access Admin Dashboard

Once your ID is added and the bot is running:

```bash
# In Telegram, send to your bot:
/admin
```

## Admin Dashboard Features

### 🔧 Main Dashboard
- View platform stats (users, rooms, volume)
- Quick access to all admin functions

### ➕ Create Room
Interactive room creation wizard:

1. **Set Title** - Name your market (e.g., "SOL to $200 by midnight?")
2. **Set Oracle Feed** - Choose price feed (SOL/USD, BTC/USD, ETH/USD, BONK/USD)
3. **Set Lock Time** - When betting closes (5min, 15min, 30min, 1h, 2h, 4h)
4. **Set Settle Time** - When room settles (same presets)
5. **Set Min Bet** - Minimum bet amount in SOL
6. **Set Capacity** - Max players (5, 10, 20, 50)
7. **Deploy** - Create room on-chain

### 📋 Room Management
- View active rooms
- Monitor room status
- See player counts and pools

### 👥 User Management
- View total users
- User statistics
- (More features coming)

## Room Creation Flow Example

```
/admin
↓
Click "➕ Create Room"
↓
Click "📝 Set Title" → Type: "SOL hits $150?"
↓
Click "📊 Set Oracle Feed" → Select "SOL/USD"
↓
Click "⏰ Set Lock Time" → Select "15 minutes"
↓
Click "⏱ Set Settle Time" → Select "30 minutes"
↓
Click "💰 Set Min/Max Bet" → Type: "0.05"
↓
Click "👥 Set Capacity" → Select "10 Players"
↓
Click "✅ Deploy Room" → Room goes live!
```

## Room Lifecycle

Once deployed, rooms follow this flow:

1. **OPEN** - Users can join and bet (until lock time)
2. **LOCKED** - Betting closed, oracle price captured
3. **SETTLED** - Final price checked, winners paid, room archived

## Security

- Only Telegram IDs in `ADMIN_IDS` can access `/admin`
- All admin actions are logged
- Room deployment creates database records immediately
- On-chain deployment can be added later

## Tips

- **Lock time**: How long users have to join (from now)
- **Settle time**: When the market resolves (from now)
- **Oracle feed**: Must match available price feeds
- **Capacity**: More players = bigger pools
- **Min bet**: Balance accessibility vs meaningful stakes

## Coming Soon

- [ ] Room templates (quick deploy common markets)
- [ ] Edit existing rooms
- [ ] Cancel/refund rooms
- [ ] Batch room creation
- [ ] Scheduled rooms
- [ ] User ban/unban
- [ ] Analytics dashboard
- [ ] Export reports

## Troubleshooting

**"Access denied" when using /admin:**
- Check your Telegram ID is in `ADMIN_IDS` array
- Restart the bot after editing config

**Room not appearing:**
- Check bot logs for errors
- Verify all fields were set
- Check database connection

**Need help?**
Check bot logs: `npm run dev` shows all activity

---

Built for ROOMS • Version 1.0

