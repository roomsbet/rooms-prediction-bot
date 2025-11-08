# Custom ROOMS Oracles

## Proprietary Oracle Infrastructure

ROOMS uses custom-built oracle infrastructure designed specifically for prediction markets, delivering real-time price data with millisecond accuracy.

```mermaid
graph TB
    subgraph "Oracle Network Architecture"
        subgraph "Data Ingestion Layer"
            A[CryptoCompare<br/>Primary Feed]
            B[Binance<br/>Exchange Data]
            C[CoinGecko<br/>Market Data]
            D[DexScreener<br/>DEX Feeds]
        end
        
        subgraph "Processing Layer"
            E[Data Validator<br/>Schema Validation]
            F[Outlier Filter<br/>Statistical Analysis]
            G[Aggregation Engine<br/>Weighted Average]
        end
        
        subgraph "Consensus Layer"
            H[Price Normalizer<br/>Format Standardization]
            I[Timestamp Sync<br/>Clock Synchronization]
            J[Consensus Algorithm<br/>Byzantine Fault Tolerant]
        end
        
        subgraph "Distribution Layer"
            K[Cache Layer<br/>Redis Cluster]
            L[Event Stream<br/>WebSocket Server]
            M[Historical DB<br/>TimescaleDB]
        end
        
        A & B & C & D --> E
        E --> F
        F --> G
        G --> H
        H --> I
        I --> J
        J --> K & L & M
    end
```

## Multi-Source Aggregation

Our oracle system aggregates data from multiple sources for reliability:

### Primary Sources
**CryptoCompare** - Fastest API for major cryptocurrencies  
**Binance** - Real-time exchange data  
**CoinGecko** - Comprehensive market coverage  
**DexScreener** - DEX and token price feeds  

### Specialized Feeds
**Pump.fun Integration** - Real-time market cap tracking  
**Custom Token Feeds** - Any Solana token support  
**Price Feeds** - USD prices for thousands of assets  

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant S as Data Sources
    participant V as Validator
    participant A as Aggregator
    participant C as Consensus
    participant R as Redis Cache
    participant M as Monitor
    participant SE as Settlement Engine
    
    loop Every 3 seconds
        S->>V: Raw Price Data
        V->>V: Schema Validation
        V->>A: Validated Data
        A->>A: Calculate Weighted Average
        A->>C: Proposed Price
        C->>C: Byzantine Consensus
        C->>R: Cache Price
        R-->>M: Current Price
        M->>M: Check Targets
        alt Target Met
            M->>SE: Trigger Settlement
            SE->>SE: Process Payouts
        end
    end
```

## Performance Metrics

```mermaid
graph LR
    subgraph "Latency Benchmarks"
        A[Data Fetch:<br/>5-10ms]
        B[Processing:<br/>2-5ms]
        C[Consensus:<br/>1-3ms]
        D[Total:<br/>8-18ms]
    end
    
    subgraph "Reliability Metrics"
        E[Uptime:<br/>99.99%]
        F[Data Accuracy:<br/>99.98%]
        G[Failover:<br/>< 100ms]
    end
    
    A --> D
    B --> D
    C --> D
```

**3-second polling** - Pump.fun tokens checked every 3 seconds  
**Millisecond updates** - Major coins updated instantly  
**Sub-second settlement** - Markets settle the moment targets are hit  
**99.9% uptime** - Redundant systems ensure reliability  

## How It Works

1. **Data Collection** - Multiple sources queried simultaneously
2. **Validation** - Cross-reference sources for accuracy
3. **Aggregation** - Weighted average of reliable sources
4. **Storage** - Prices recorded on-chain for transparency
5. **Settlement** - Automatic when conditions are met

## Reliability

**Redundancy** - Multiple sources per asset  
**Automatic Failover** - Switches sources if one fails  
**Validation** - Cross-checks prevent bad data  
**Monitoring** - 24/7 system health checks  

## Consensus Algorithm

```mermaid
graph TD
    A[Receive Prices] --> B{Count Sources}
    B -->|< 3 Sources| C[Wait for More]
    B -->|>= 3 Sources| D[Calculate Median]
    D --> E{Check Variance}
    E -->|High Variance| F[Flag Outliers]
    E -->|Low Variance| G[Accept Price]
    F --> H[Remove Outliers]
    H --> D
    G --> I[Update Cache]
    I --> J[Trigger Events]
```

## Transparency

All oracle data is:
- **On-chain** - Verifiable by anyone
- **Timestamped** - Exact time of price capture
- **Public** - Settlement prices visible to all
- **Auditable** - Full history available

## Supported Markets

**Coin Prices** - Any cryptocurrency USD price  
**Market Caps** - Real-time market cap tracking  
**Pump.fun Tokens** - Instant market cap updates  
**Custom Conditions** - Extensible for new market types  

---

_Trusted by Helius • Powered by Turnkey • Built on Solana_
