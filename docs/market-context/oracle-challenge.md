# The Oracle Challenge

## What is an Oracle?

An oracle is a system that provides real-world data (like prices) to blockchain applications. For prediction markets, oracles determine when market conditions are met and trigger settlements.

## The Challenge

Most prediction markets struggle with oracles:

### Slow Updates
Traditional oracles update every few minutes or hours, causing delays in settlement.

### Single Points of Failure
Relying on one oracle source creates risk - if it fails, markets can't settle.

### Limited Coverage
Most oracles only support major assets, limiting market types.

### Manual Intervention
Many platforms require manual settlement, introducing delays and potential errors.

## ROOMS Solution: Custom Oracle Infrastructure

ROOMS uses proprietary oracle infrastructure designed specifically for prediction markets:

### Multi-Source Aggregation
- **CryptoCompare** - Fastest price API for major cryptocurrencies
- **Binance** - Real-time exchange data
- **CoinGecko** - Comprehensive market data
- **DexScreener** - DEX price feeds
- **Custom feeds** - Proprietary Pump.fun and token tracking

### Instant Updates
- **3-second polling** - Pump.fun tokens checked every 3 seconds
- **Real-time feeds** - Major coins updated in milliseconds
- **Automatic settlement** - Markets settle the moment targets are hit

### Reliability
- **Redundancy** - Multiple sources ensure uptime
- **Fallback systems** - Automatic switching if one source fails
- **Validation** - Cross-reference multiple sources for accuracy

### Coverage
- **Any cryptocurrency** - Support for thousands of assets
- **Market cap tracking** - Real-time market cap for tokens
- **Price tracking** - USD prices for any coin
- **Custom conditions** - Extensible for new market types

## How It Works

1. **Market Created** - User sets target (price or market cap)
2. **Continuous Monitoring** - Oracle checks conditions every few seconds
3. **Target Met** - Oracle detects when condition is satisfied
4. **Instant Settlement** - Market settles automatically
5. **Payouts Distributed** - Winners receive SOL immediately

## Trust & Transparency

- All oracle data is verifiable on-chain
- Settlement prices are recorded in room history
- Users can verify results independently
- No manual intervention required

---

_Trusted by Helius • Powered by Turnkey • Built on Solana_

