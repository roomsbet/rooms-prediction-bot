# Instant Settlement

## How It Works

ROOMS uses proprietary oracle infrastructure to monitor markets 24/7 and settle them instantly when conditions are met.

```mermaid
graph TD
    A[Market Created] --> B{Oracle Monitor<br/>3s Polling Cycle}
    B --> C{Check Price Feed}
    C --> D{Target Met?}
    D -->|No| B
    D -->|Yes| E[Trigger Settlement]
    E --> F[Calculate Winners]
    F --> G[Execute Payouts]
    G --> H[Send Notifications]
    H --> I[Update Database]
    I --> J[Market Settled]
    
    style A fill:#4a90e2
    style E fill:#e74c3c
    style J fill:#2ecc71
```

## Settlement Flow Architecture

```mermaid
sequenceDiagram
    participant M as Market
    participant O as Oracle Monitor
    participant P as Price Feed
    participant S as Settlement Engine
    participant B as Blockchain
    participant U as Users
    
    M->>O: Market Registered
    loop Every 3 seconds
        O->>P: Query Price
        P-->>O: Current Price
        O->>O: Compare vs Target
    end
    O->>S: Target Met - Trigger Settlement
    S->>B: Fetch Pool Data
    B-->>S: Pool State
    S->>S: Calculate Payouts
    S->>B: Execute Transfers
    B-->>S: Confirmations
    S->>U: Push Notifications
    U-->>S: Acknowledged
```

### The Process

1. **Market Created** - User sets target (e.g., "SOL to $165")
2. **Oracle Monitoring** - System checks price every 3 seconds
3. **Target Detected** - Oracle detects when SOL hits $165
4. **Instant Settlement** - Market settles automatically
5. **Push Notification** - Users receive instant alerts
6. **Payout Distribution** - Winners receive SOL immediately

### No Waiting

Unlike traditional prediction markets:
- No waiting for scheduled settlement times
- No manual intervention required
- No delays or disputes
- Instant settlement when targets are hit
- Automatic payout distribution
- Real-time notifications

## Oracle Infrastructure

ROOMS uses custom oracle infrastructure:

```mermaid
graph TB
    subgraph "Data Sources"
        A[CryptoCompare API]
        B[Binance Feed]
        C[CoinGecko API]
        D[DexScreener]
    end
    
    subgraph "Aggregation Layer"
        E[Data Validator]
        F[Outlier Detection]
        G[Weighted Average]
    end
    
    subgraph "Processing Layer"
        H[Price Normalizer]
        I[Timestamp Verification]
        J[Consensus Algorithm]
    end
    
    subgraph "Settlement Layer"
        K[Condition Evaluator]
        L[Settlement Trigger]
        M[Payout Calculator]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I --> J
    J --> K
    K --> L
    L --> M
```

**3-second polling** for Pump.fun tokens  
**Millisecond updates** for major cryptocurrencies  
**Multi-source aggregation** for reliability  
**Automatic failover** if one source fails  

## Settlement Types

### Price Targets
- "Will SOL reach $165?"
- Settles instantly when price hits target

### Market Cap Targets
- "Will $TOKEN hit $5M market cap?"
- Settles instantly when market cap reaches target

### Time-Based
- Markets can also settle at scheduled times
- Oracle still monitors for early settlement

## Transparency

All settlements are:
- **Recorded on-chain** - Verifiable by anyone
- **Transparent** - Settlement price is public
- **Automatic** - No human intervention
- **Fair** - Based solely on oracle data

---

_Trusted by Helius • Powered by Turnkey • Built on Solana_
