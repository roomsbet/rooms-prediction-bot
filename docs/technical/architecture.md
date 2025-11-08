# Architecture

## System Architecture

ROOMS leverages a sophisticated multi-layer architecture designed for enterprise-scale performance.

## Layers

### Handler Layer
Event-driven command processing with real-time state management. Handles all Telegram interactions and user commands.

### Domain Layer
Core business logic ensuring atomic operations and data integrity. Manages rooms, bets, wallets, settlements, and referrals.

### Infrastructure Layer
Blockchain integration via Helius RPC and proprietary oracle systems. Handles all external API calls and data feeds.

### Security Layer
Advanced key management with Turnkey and zero-trust principles. Ensures user funds are always secure.

## Technology Stack

- **TypeScript** - Type-safe application code
- **Node.js** - Runtime environment
- **Telegraf** - Telegram bot framework
- **Prisma** - Database ORM
- **PostgreSQL** - Relational database
- **Solana Web3.js** - Blockchain integration
- **Turnkey SDK** - Key management

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

