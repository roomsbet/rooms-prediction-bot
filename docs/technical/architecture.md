# Architecture

## System Architecture

ROOMS leverages a sophisticated multi-layer architecture designed for enterprise-scale performance.

```mermaid
graph TD
    subgraph "Presentation Layer"
        A[Telegram Bot API] --> B[Telegraf Middleware]
        B --> C[Command Router]
    end
    
    subgraph "Handler Layer"
        C --> D[Event Handlers]
        D --> E[State Manager]
        E --> F[Callback Dispatcher]
    end
    
    subgraph "Domain Layer"
        F --> G[Room Service]
        F --> H[Wallet Service]
        F --> I[Bet Service]
        F --> J[Settlement Service]
        F --> K[Referral Service]
    end
    
    subgraph "Infrastructure Layer"
        G --> L[Prisma Client]
        H --> M[Turnkey KMS]
        I --> L
        J --> N[Oracle Aggregator]
        K --> L
        
        L --> O[PostgreSQL]
        M --> P[HSM Cluster]
        N --> Q[Multi-Source Feeds]
    end
    
    subgraph "Blockchain Layer"
        H --> R[Helius RPC]
        J --> R
        R --> S[Solana Network]
    end
    
    style A fill:#4a90e2
    style O fill:#2ecc71
    style P fill:#e74c3c
    style S fill:#9b59b6
```

## Architectural Layers

### Handler Layer
Event-driven command processing with real-time state management. Handles all Telegram interactions and user commands.

**Key Components:**
- Command parsing and validation
- Conversation state management
- Inline keyboard handling
- Error boundary implementation

### Domain Layer
Core business logic ensuring atomic operations and data integrity. Manages rooms, bets, wallets, settlements, and referrals.

**Design Patterns:**
- Repository pattern for data access
- Service layer for business logic
- Domain events for cross-cutting concerns
- CQRS for read/write separation

### Infrastructure Layer
Blockchain integration via Helius RPC and proprietary oracle systems. Handles all external API calls and data feeds.

**Components:**
- RPC connection pool management
- Oracle data aggregation pipeline
- External API integration layer
- Caching and rate limiting

### Security Layer
Advanced key management with Turnkey and zero-trust principles. Ensures user funds are always secure.

**Security Measures:**
- Hardware Security Module (HSM) integration
- Zero-knowledge encryption
- Multi-signature transaction approval
- Audit logging and compliance

## Technology Stack

```mermaid
graph TB
    subgraph "Application Runtime"
        A[TypeScript 5.3+<br/>Type-Safe Codebase]
        B[Node.js 20 LTS<br/>High-Performance Runtime]
        C[Telegraf 4.x<br/>Bot Framework]
    end
    
    subgraph "Data Management"
        D[Prisma 5.x<br/>Type-Safe ORM]
        E[PostgreSQL 15+<br/>ACID Compliance]
        F[Connection Pooling<br/>PgBouncer]
    end
    
    subgraph "Blockchain Integration"
        G[Solana Web3.js<br/>RPC Client]
        H[Helius RPC<br/>Dedicated Infrastructure]
        I[Turnkey SDK<br/>Cryptographic Operations]
    end
    
    subgraph "Monitoring & Observability"
        J[Custom Metrics Engine]
        K[Distributed Tracing]
        L[Error Tracking System]
    end
    
    A --> B
    B --> C
    B --> D
    D --> E
    E --> F
    B --> G
    G --> H
    G --> I
    B --> J
    J --> K
    J --> L
```

## Infrastructure

### Database
- PostgreSQL for data persistence
- Prisma for type-safe queries
- Optimized indexes for performance
- Materialized views for analytics

### Blockchain
- Helius RPC for ultra-fast transactions
- Solana Web3.js for interactions
- Real-time transaction monitoring
- Automatic retry logic

### Oracles
- Multi-source price aggregation
- 3-second polling for tokens
- Millisecond updates for major coins
- Automatic failover systems

### Security
- Turnkey for key management
- Encrypted private keys
- Zero-knowledge architecture
- 24/7 monitoring

## Performance

- **Sub-second response times** (powered by Helius)
- **Instant market settlement**
- **99.9% uptime** with failover
- **Scalable** to millions of users

## Deployment

- **Docker** - Containerized deployment
- **Kubernetes** - Orchestration (optional)
- **Terraform** - Infrastructure as code
- **CI/CD** - Automated deployments

---

_Trusted by Helius • Powered by Turnkey • Built on Solana_

