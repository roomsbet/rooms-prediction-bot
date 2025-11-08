# Understanding Odds

## How Odds Work in ROOMS

ROOMS uses parimutuel betting, meaning odds are dynamic and based on pool distribution.

## Calculating Your Payout

Your payout depends on:
1. **Your bet size** - How much you bet
2. **Total winning pool** - All bets on winning side
3. **Your share** - Your bet / Total winning bets
4. **Fees** - 3% deducted from pool

### Formula

```
Your Share = Your Bet / Total Winning Bets
Payout Pool = Winning Pool × (1 - 0.03)
Your Payout = Your Share × Payout Pool
```

## Example Scenarios

### Scenario 1: Small Pool, You Win

**Room:** "Will SOL reach $165?"  
**YES Pool:** 5 SOL (you bet 2 SOL, 1 other bet 3 SOL)  
**NO Pool:** 10 SOL

**SOL hits $165** → YES wins!

- Your share: 2 SOL / 5 SOL = 40%
- Payout pool: 5 SOL × 97% = 4.85 SOL
- Your payout: 40% × 4.85 SOL = **1.94 SOL**
- Your profit: 1.94 SOL - 2 SOL = **-0.06 SOL**

### Scenario 2: Large Pool, You Win

**YES Pool:** 50 SOL (you bet 2 SOL)  
**NO Pool:** 5 SOL

**YES wins!**

- Your share: 2 SOL / 50 SOL = 4%
- Payout pool: 50 SOL × 97% = 48.5 SOL
- Your payout: 4% × 48.5 SOL = **1.94 SOL**
- Your profit: 1.94 SOL - 2 SOL = **-0.06 SOL**

## Key Insights

### Pool Size Matters
- **Smaller winning pool** = Higher percentage share
- **Larger winning pool** = Lower percentage share
- Your absolute payout may be similar, but percentage differs

### Early vs Late Bets
- **Early bet** - Pool is small, you get larger share
- **Late bet** - Pool is large, you get smaller share
- But if more people bet your side, pool grows

### Balanced vs Unbalanced
- **Balanced pools** - More even payouts
- **Unbalanced pools** - Winners get larger share of smaller pool

## Reading the Odds

When viewing a room:
- **YES Pool** - Shows total SOL bet on YES
- **NO Pool** - Shows total SOL bet on NO
- **Your potential payout** - Estimated based on current pools

## Strategy

1. **Bet early** - Get better share percentage
2. **Watch pools** - See where money is going
3. **Consider fees** - 3% affects smaller bets more
4. **Diversify** - Spread bets across rooms

---

_Trusted by Helius • Powered by Turnkey • Built on Solana_

