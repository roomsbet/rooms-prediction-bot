# Parimutuel Pools

## How Parimutuel Betting Works

ROOMS uses a parimutuel betting system where all bets on the same side are pooled together, and winners share the pool proportionally.

### The Pool

When you place a bet:
- Your SOL goes into the pool for your chosen side (YES or NO)
- The pool grows as more people bet
- Odds change dynamically based on pool distribution

### Winning

When a market settles:
- The winning side's pool is distributed to winners
- Your payout = (Your bet / Total winning bets) × Winning pool × (1 - fees)
- Fees: 3% total (2% protocol, 1% host)

## Example

**Room:** "Will SOL reach $165?"

**YES Pool:** 10 SOL (5 bets of 2 SOL each)  
**NO Pool:** 5 SOL (2 bets of 2.5 SOL each)  
**Total Pool:** 15 SOL

**You bet:** 2 SOL on YES

**SOL hits $165** → YES wins!

**Your payout:**
- Your share: 2 SOL / 10 SOL = 20%
- Winning pool: 10 SOL
- After fees (3%): 9.7 SOL
- Your payout: 20% × 9.7 SOL = **1.94 SOL**
- Your profit: 1.94 SOL - 2 SOL = **-0.06 SOL** (small loss due to fees)

**If NO had won:**
- You would lose your 2 SOL bet
- NO bettors would share the 5 SOL pool

## Dynamic Odds

Odds change in real-time as people bet:

- **More YES bets** → Lower YES payouts (more people to share with)
- **More NO bets** → Lower NO payouts
- **Balanced pools** → More even payouts

## Strategy Tips

1. **Early bets** - Get better odds before pools fill up
2. **Watch the pools** - See where money is going
3. **Consider fees** - 3% fee affects smaller bets more
4. **Diversify** - Don't put all SOL in one room

---

_Trusted by Helius • Powered by Turnkey • Built on Solana_

