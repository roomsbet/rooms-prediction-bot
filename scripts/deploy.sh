#!/bin/bash
###############################################################################
# ROOMS Bot Enterprise Deployment and Management Suite
# Trusted by Helius • Powered by Turnkey
# Comprehensive deployment, monitoring, and maintenance scripts
###############################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="${LOG_DIR:-/var/log/rooms}"
BACKUP_DIR="${BACKUP_DIR:-/backups/rooms}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/deploy.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/deploy.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/deploy.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/deploy.log"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_deps=()
    
    command -v node >/dev/null 2>&1 || missing_deps+=("node")
    command -v npm >/dev/null 2>&1 || missing_deps+=("npm")
    command -v psql >/dev/null 2>&1 || missing_deps+=("psql")
    command -v pg_dump >/dev/null 2>&1 || missing_deps+=("pg_dump")
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 20 ]; then
        log_error "Node.js version 20+ required. Found: $(node -v)"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file not found: $ENV_FILE"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Load environment variables
load_env() {
    log_info "Loading environment variables..."
    
    if [ -f "$ENV_FILE" ]; then
        set -a
        source "$ENV_FILE"
        set +a
        log_success "Environment variables loaded"
    else
        log_error "Environment file not found: $ENV_FILE"
        exit 1
    fi
}

# Create necessary directories
setup_directories() {
    log_info "Setting up directories..."
    
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$PROJECT_ROOT/dist"
    
    log_success "Directories created"
}

# Backup database
backup_database() {
    log_info "Creating database backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/db_backup_$timestamp.sql"
    
    if pg_dump "$DATABASE_URL" > "$backup_file" 2>>"$LOG_DIR/backup.log"; then
        gzip "$backup_file"
        log_success "Database backed up to: ${backup_file}.gz"
        
        # Keep only last 7 days of backups
        find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete
    else
        log_error "Database backup failed"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    if npm ci --only=production >>"$LOG_DIR/install.log" 2>&1; then
        log_success "Dependencies installed"
    else
        log_error "Failed to install dependencies"
        exit 1
    fi
}

# Generate Prisma client
generate_prisma() {
    log_info "Generating Prisma client..."
    
    cd "$PROJECT_ROOT"
    
    if npx prisma generate >>"$LOG_DIR/prisma.log" 2>&1; then
        log_success "Prisma client generated"
    else
        log_error "Failed to generate Prisma client"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    if npx prisma migrate deploy >>"$LOG_DIR/migrate.log" 2>&1; then
        log_success "Migrations completed"
    else
        log_error "Migration failed"
        exit 1
    fi
}

# Build TypeScript
build_project() {
    log_info "Building TypeScript project..."
    
    cd "$PROJECT_ROOT"
    
    if npm run build >>"$LOG_DIR/build.log" 2>&1; then
        log_success "Build completed"
    else
        log_error "Build failed"
        exit 1
    fi
}

# Run database functions
setup_database_functions() {
    log_info "Setting up database functions..."
    
    cd "$PROJECT_ROOT"
    
    if [ -f "prisma/functions.sql" ]; then
        psql "$DATABASE_URL" -f prisma/functions.sql >>"$LOG_DIR/db_functions.log" 2>&1 || log_warning "Some database functions may have failed"
    fi
    
    if [ -f "prisma/views.sql" ]; then
        psql "$DATABASE_URL" -f prisma/views.sql >>"$LOG_DIR/db_views.log" 2>&1 || log_warning "Some database views may have failed"
    fi
    
    if [ -f "prisma/analytics.sql" ]; then
        psql "$DATABASE_URL" -f prisma/analytics.sql >>"$LOG_DIR/db_analytics.log" 2>&1 || log_warning "Some analytics functions may have failed"
    fi
    
    if [ -f "prisma/advanced_functions.sql" ]; then
        psql "$DATABASE_URL" -f prisma/advanced_functions.sql >>"$LOG_DIR/db_advanced.log" 2>&1 || log_warning "Some advanced functions may have failed"
    fi
    
    log_success "Database functions setup completed"
}

# Health check
health_check() {
    log_info "Running health checks..."
    
    # Check database connectivity
    if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
        log_success "Database connection OK"
    else
        log_error "Database connection failed"
        return 1
    fi
    
    # Check if bot process is running
    if pgrep -f "node.*dist/index.js" >/dev/null; then
        log_success "Bot process is running"
    else
        log_warning "Bot process not running"
    fi
    
    return 0
}

# Start bot
start_bot() {
    log_info "Starting bot..."
    
    cd "$PROJECT_ROOT"
    
    # Stop existing process if running
    pkill -f "node.*dist/index.js" || true
    sleep 2
    
    # Start new process
    nohup npm start >>"$LOG_DIR/bot.log" 2>&1 &
    local pid=$!
    
    sleep 5
    
    if ps -p $pid > /dev/null; then
        log_success "Bot started with PID: $pid"
        echo $pid > /tmp/rooms-bot.pid
    else
        log_error "Failed to start bot"
        exit 1
    fi
}

# Stop bot
stop_bot() {
    log_info "Stopping bot..."
    
    if [ -f /tmp/rooms-bot.pid ]; then
        local pid=$(cat /tmp/rooms-bot.pid)
        if ps -p $pid > /dev/null; then
            kill $pid
            log_success "Bot stopped (PID: $pid)"
        fi
        rm -f /tmp/rooms-bot.pid
    else
        pkill -f "node.*dist/index.js" || true
        log_info "Bot process terminated"
    fi
}

# Restart bot
restart_bot() {
    log_info "Restarting bot..."
    stop_bot
    sleep 2
    start_bot
}

# Main deployment function
deploy() {
    log_info "Starting deployment process..."
    log_info "Trusted by Helius • Powered by Turnkey"
    
    check_prerequisites
    load_env
    setup_directories
    backup_database
    install_dependencies
    generate_prisma
    run_migrations
    setup_database_functions
    build_project
    
    if [ "${RESTART_BOT:-true}" = "true" ]; then
        restart_bot
    fi
    
    health_check
    
    log_success "Deployment completed successfully!"
}

# Main script logic
main() {
    case "${1:-deploy}" in
        deploy)
            deploy
            ;;
        start)
            load_env
            start_bot
            ;;
        stop)
            stop_bot
            ;;
        restart)
            load_env
            restart_bot
            ;;
        backup)
            load_env
            backup_database
            ;;
        migrate)
            load_env
            run_migrations
            ;;
        build)
            install_dependencies
            generate_prisma
            build_project
            ;;
        health)
            load_env
            health_check
            ;;
        *)
            echo "Usage: $0 {deploy|start|stop|restart|backup|migrate|build|health}"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
