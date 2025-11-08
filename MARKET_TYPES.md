# ROOMS Market Types Guide

## Overview

ROOMS now supports flexible prediction markets tailored to different types of predictions on Solana.

## Supported Market Types

### 1. 💰 SOL Price Markets

**Example:** "Will SOL cross $170 by midnight?"

**Setup:**
1. Select "💰 SOL Price" market type
2. Enter target price (e.g., `170`)
3. Set target date/time
4. Configure betting window

**Oracle:** Real-time SOL/USD price feed

**Settlement:** 
- LONG wins if SOL ≥ target price at settle time
- SHORT wins if SOL < target price at settle time

---

### 2. 🚀 Pump.fun Coin Market Cap

**Example:** "Will $PEPE reach $1M market cap by tomorrow?"

**Setup:**
1. Select "🚀 Pump.fun Coin Market Cap"
2. Enter token symbol (e.g., `PEPE`)
3. Enter target market cap (e.g., `1000000` for $1M)
4. Set target date/time
5. Configure betting window

**Oracle:** Pump.fun API + Solana on-chain data

**Settlement:**
- LONG wins if token market cap ≥ target at settle time
- SHORT wins if token market cap < target at settle time

**Note:** Token must exist on pump.fun platform

---

### 3. 📝 Custom Markets

**Example:** "Will Bitcoin hit $50k before SOL hits $200?"

**Setup:**
1. Select "📝 Custom Market"
2. Enter custom prediction/question
3. Set target date/time
4. Configure betting window

**Oracle:** Manual settlement by admin or custom oracle integration

**Settlement:** Admin resolves the market based on the outcome

---

## Room Creation Flow

### Example: SOL Price Market

```
/admin
↓
Click "➕ Create Room"
↓
"📝 Set Title" → Type: "SOL to $170 by midnight?"
↓
"📊 Set Market Type" → Select "💰 SOL Price"
↓
Type: "170" (target price)
↓
"📅 Set Target Date" → Type: "today 23:59"
↓
"⏰ Set Lock Time" → Select "15 minutes"
↓
"⏱ Set Settle Time" → Select "at target date" (8 hours)
↓
"💰 Set Min Bet" → Type: "0.05"
↓
"👥 Set Capacity" → Select "20 Players"
↓
"✅ Deploy Room" → Market goes live!
```

### Example: Pump.fun Market

```
/admin
↓
Click "➕ Create Room"
↓
"📝 Set Title" → Type: "$PEPE to $1M by tomorrow?"
↓
"📊 Set Market Type" → Select "🚀 Pump.fun Coin Market Cap"
↓
Type: "PEPE" (token symbol)
↓
Type: "1000000" (target market cap)
↓
"📅 Set Target Date" → Type: "tomorrow 5pm"
↓
Continue with betting setup...
↓
"✅ Deploy Room"
```

## Oracle Integration

### SOL Price (Implemented)
- Source: CoinGecko API (can be upgraded to Pyth Network)
- Update frequency: Real-time
- Reliability: High

### Pump.fun (To Implement)
- Source: Pump.fun API + Solana on-chain
- Requires: Token address resolution
- Method: Query bonding curve state

### Custom (Manual)
- Admin resolves market
- Can integrate custom oracles later
- Maximum flexibility

## Settlement Logic

### Automatic Settlement (SOL Price)
```typescript
if (currentSolPrice >= targetPrice) {
  winningSide = 'LONG';
} else {
  winningSide = 'SHORT';
}
```

### Pump.fun Settlement (To Implement)
```typescript
const tokenMcap = await getPumpfunMarketCap(tokenAddress);
if (tokenMcap >= targetMcap) {
  winningSide = 'LONG';
} else {
  winningSide = 'SHORT';
}
```

### Custom Settlement (Manual)
Admin marks winning side based on outcome verification.

## Best Practices

### Lock Times
- **SOL Price**: 5-30 minutes before target time
- **Pump.fun**: 15-60 minutes (more volatile)
- **Custom**: Depends on prediction type

### Settle Times
- Should align with target date/time
- Add buffer for oracle delays (1-5 minutes)
- For pump.fun: Account for chain confirmation

### Minimum Bets
- SOL Price: 0.05 - 0.1 SOL
- Pump.fun: 0.05 - 0.2 SOL (higher risk)
- Custom: Varies by market

## Coming Soon

- [ ] Pyth Network integration for SOL price
- [ ] Automatic pump.fun token resolution
- [ ] Multi-asset price markets (BTC, ETH via SOL)
- [ ] Time-based markets ("Will X happen before Y?")
- [ ] Governance markets
- [ ] NFT floor price markets

## Technical Notes

### Database Schema
Markets store:
- `marketType`: 'sol_price' | 'pumpfun_mcap' | 'custom'
- `oracleFeed`: Feed identifier (e.g., "SOL/USD", "PUMPFUN:PEPE")
- `targetValue`: Numeric target (price or mcap)
- `targetDate`: Settlement date/time
- `tokenAddress`: For pump.fun markets
- `tokenSymbol`: For display

### Oracle Resolution
Priority:
1. On-chain oracle (Pyth/Switchboard)
2. API feeds (CoinGecko, Pump.fun)
3. Manual admin resolution

---

Built for ROOMS • Flexible Prediction Markets

