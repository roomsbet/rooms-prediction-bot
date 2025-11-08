-- ROOMS Advanced Database Optimization and Analytics
-- Trusted by Helius • Powered by Turnkey
-- Comprehensive database functions, triggers, and performance optimizations

-- ============================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bet_user_room ON "Bet"("userId", "roomId");
CREATE INDEX IF NOT EXISTS idx_bet_created_at ON "Bet"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_bet_status ON "Bet"(status);
CREATE INDEX IF NOT EXISTS idx_bet_won ON "Bet"(won) WHERE won = true;
CREATE INDEX IF NOT EXISTS idx_room_status ON "Room"(status);
CREATE INDEX IF NOT EXISTS idx_room_settle_time ON "Room"("settleTime");
CREATE INDEX IF NOT EXISTS idx_room_market_type ON "Room"("marketType");
CREATE INDEX IF NOT EXISTS idx_transaction_user_type ON "Transaction"("userId", type);
CREATE INDEX IF NOT EXISTS idx_transaction_created_at ON "Transaction"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_referral_referrer ON "Referral"("referrerId");
CREATE INDEX IF NOT EXISTS idx_referral_referred ON "Referral"("referredId");
CREATE INDEX IF NOT EXISTS idx_user_telegram_id ON "User"("telegramId");
CREATE INDEX IF NOT EXISTS idx_user_created_at ON "User"("createdAt");

-- ============================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_market_stats AS
SELECT 
    DATE("createdAt") as date,
    "marketType",
    COUNT(DISTINCT "roomId") as rooms_created,
    COUNT(DISTINCT "userId") as unique_players,
    COUNT(*) as total_bets,
    SUM(amount) as total_volume,
    AVG(amount) as avg_bet_size,
    COUNT(*) FILTER (WHERE won = true) as winning_bets,
    SUM(CASE WHEN won THEN payout ELSE 0 END) as total_payouts,
    SUM(CASE WHEN won THEN payout * 0.02 ELSE 0 END) as protocol_fees,
    SUM(CASE WHEN won THEN payout * 0.01 ELSE 0 END) as host_fees
FROM "Bet" b
JOIN "Room" r ON b."roomId" = r.id
GROUP BY DATE("createdAt"), "marketType";

CREATE UNIQUE INDEX ON daily_market_stats(date, "marketType");

CREATE MATERIALIZED VIEW IF NOT EXISTS user_leaderboard AS
SELECT 
    u.id,
    u."telegramId",
    COUNT(DISTINCT b."roomId") as rooms_participated,
    COUNT(b.id) as total_bets,
    COUNT(b.id) FILTER (WHERE b.won = true) as wins,
    COUNT(b.id) FILTER (WHERE b.won = false) as losses,
    CASE 
        WHEN COUNT(b.id) > 0 
        THEN (COUNT(b.id) FILTER (WHERE b.won = true)::DECIMAL / COUNT(b.id)::DECIMAL * 100)
        ELSE 0 
    END as win_rate,
    SUM(b.amount) as total_staked,
    SUM(CASE WHEN b.won THEN b.payout ELSE 0 END) as total_winnings,
    SUM(CASE WHEN b.won THEN b.payout - b.amount ELSE -b.amount END) as net_profit,
    MAX(CASE WHEN b.won THEN b.payout - b.amount ELSE NULL END) as biggest_win,
    MAX(CASE WHEN NOT b.won THEN b.amount ELSE NULL END) as biggest_loss,
    AVG(b.amount) as avg_bet_size,
    COUNT(DISTINCT r."marketType") as market_types_played,
    (SELECT COUNT(*) FROM "Referral" WHERE "referrerId" = u.id) as referrals_made,
    u."createdAt" as account_created,
    MAX(b."createdAt") as last_bet_date
FROM "User" u
LEFT JOIN "Bet" b ON u.id = b."userId"
LEFT JOIN "Room" r ON b."roomId" = r.id
GROUP BY u.id, u."telegramId", u."createdAt";

CREATE UNIQUE INDEX ON user_leaderboard(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS room_performance_metrics AS
SELECT 
    r.id,
    r.title,
    r."marketType",
    r.status,
    COUNT(DISTINCT b."userId") as unique_players,
    COUNT(b.id) as total_bets,
    SUM(b.amount) as total_volume,
    r."longPool" as yes_pool,
    r."shortPool" as no_pool,
    CASE 
        WHEN r.pool > 0 
        THEN (r."longPool" / r.pool * 100)
        ELSE 0 
    END as yes_percentage,
    CASE 
        WHEN r.pool > 0 
        THEN (r."shortPool" / r.pool * 100)
        ELSE 0 
    END as no_percentage,
    AVG(b.amount) as avg_bet_size,
    MAX(b.amount) as max_bet,
    MIN(b.amount) as min_bet,
    r."lockPrice",
    r."settlePrice",
    CASE 
        WHEN r."lockPrice" > 0 AND r."settlePrice" IS NOT NULL
        THEN ((r."settlePrice" - r."lockPrice") / r."lockPrice" * 100)
        ELSE NULL
    END as price_change_percent,
    CASE 
        WHEN r.status = 'SETTLED' AND r."settlePrice" >= r."targetValue" THEN 'YES'
        WHEN r.status = 'SETTLED' AND r."settlePrice" < r."targetValue" THEN 'NO'
        ELSE NULL
    END as winner,
    EXTRACT(EPOCH FROM (r."settleTime" - r."createdAt")) / 60 as duration_minutes,
    EXTRACT(EPOCH FROM (r."settleTime" - r."lockTime")) / 60 as settlement_delay_minutes,
    r."createdAt",
    r."lockTime",
    r."settleTime"
FROM "Room" r
LEFT JOIN "Bet" b ON r.id = b."roomId"
GROUP BY r.id, r.title, r."marketType", r.status, r."longPool", r."shortPool", 
         r.pool, r."lockPrice", r."settlePrice", r."targetValue",
         r."createdAt", r."lockTime", r."settleTime";

CREATE UNIQUE INDEX ON room_performance_metrics(id);

-- ============================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- ============================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_market_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY room_performance_metrics;
    RAISE NOTICE 'Analytics views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- AUTOMATED TRIGGERS FOR DATA INTEGRITY
-- ============================================

CREATE OR REPLACE FUNCTION update_room_pool()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE "Room"
        SET 
            pool = pool + NEW.amount,
            "currentPlayers" = (
                SELECT COUNT(DISTINCT "userId")
                FROM "Bet"
                WHERE "roomId" = NEW."roomId" AND status = 'ACTIVE'
            ),
            "longPool" = CASE 
                WHEN NEW.side = 'YES' THEN "longPool" + NEW.amount 
                ELSE "longPool" 
            END,
            "shortPool" = CASE 
                WHEN NEW.side = 'NO' THEN "shortPool" + NEW.amount 
                ELSE "shortPool" 
            END
        WHERE id = NEW."roomId";
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle bet updates (e.g., settlement)
        IF OLD.status != NEW.status AND NEW.status = 'ACTIVE' THEN
            UPDATE "Room"
            SET 
                pool = pool + (NEW.amount - OLD.amount),
                "longPool" = CASE 
                    WHEN NEW.side = 'YES' THEN "longPool" + (NEW.amount - OLD.amount)
                    WHEN OLD.side = 'YES' THEN "longPool" - OLD.amount
                    ELSE "longPool"
                END,
                "shortPool" = CASE 
                    WHEN NEW.side = 'NO' THEN "shortPool" + (NEW.amount - OLD.amount)
                    WHEN OLD.side = 'NO' THEN "shortPool" - OLD.amount
                    ELSE "shortPool"
                END
            WHERE id = NEW."roomId";
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_pool
AFTER INSERT OR UPDATE ON "Bet"
FOR EACH ROW
EXECUTE FUNCTION update_room_pool();

CREATE OR REPLACE FUNCTION log_room_status_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO "RoomStatusLog" ("roomId", "oldStatus", "newStatus", "changedAt")
        VALUES (NEW.id, OLD.status, NEW.status, NOW())
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ADVANCED ANALYTICS FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_market_trends(
    p_start_date TIMESTAMP DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP DEFAULT NOW(),
    p_market_type TEXT DEFAULT NULL
)
RETURNS TABLE(
    date DATE,
    market_type TEXT,
    rooms_created INTEGER,
    rooms_settled INTEGER,
    total_volume DECIMAL,
    total_bets BIGINT,
    unique_players INTEGER,
    yes_wins BIGINT,
    no_wins BIGINT,
    yes_win_rate DECIMAL,
    average_settlement_time_minutes DECIMAL,
    total_fees DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(r."createdAt") as date,
        r."marketType" as market_type,
        COUNT(DISTINCT r.id) FILTER (WHERE DATE(r."createdAt") = date_series.date)::INTEGER as rooms_created,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'SETTLED' AND DATE(r."settleTime") = date_series.date)::INTEGER as rooms_settled,
        COALESCE(SUM(b.amount) FILTER (WHERE DATE(b."createdAt") = date_series.date), 0) as total_volume,
        COUNT(b.id) FILTER (WHERE DATE(b."createdAt") = date_series.date)::BIGINT as total_bets,
        COUNT(DISTINCT b."userId") FILTER (WHERE DATE(b."createdAt") = date_series.date)::INTEGER as unique_players,
        COUNT(*) FILTER (WHERE b.won = true AND b.side = 'YES' AND DATE(b."createdAt") = date_series.date)::BIGINT as yes_wins,
        COUNT(*) FILTER (WHERE b.won = true AND b.side = 'NO' AND DATE(b."createdAt") = date_series.date)::BIGINT as no_wins,
        CASE 
            WHEN COUNT(*) FILTER (WHERE b.side = 'YES' AND DATE(b."createdAt") = date_series.date) > 0
            THEN (COUNT(*) FILTER (WHERE b.won = true AND b.side = 'YES' AND DATE(b."createdAt") = date_series.date)::DECIMAL / 
                  COUNT(*) FILTER (WHERE b.side = 'YES' AND DATE(b."createdAt") = date_series.date)::DECIMAL * 100)
            ELSE 0
        END as yes_win_rate,
        COALESCE(AVG(EXTRACT(EPOCH FROM (r."settleTime" - r."lockTime")) / 60) FILTER (
            WHERE r.status = 'SETTLED' AND DATE(r."settleTime") = date_series.date
        ), 0) as average_settlement_time_minutes,
        COALESCE(SUM(CASE WHEN b.won THEN b.payout * 0.03 ELSE 0 END) FILTER (
            WHERE DATE(b."createdAt") = date_series.date
        ), 0) as total_fees
    FROM generate_series(
        DATE(p_start_date),
        DATE(p_end_date),
        INTERVAL '1 day'
    ) as date_series(date)
    CROSS JOIN "Room" r
    LEFT JOIN "Bet" b ON r.id = b."roomId"
    WHERE (p_market_type IS NULL OR r."marketType" = p_market_type)
    GROUP BY date_series.date, r."marketType"
    ORDER BY date_series.date DESC, r."marketType";
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_user_rankings(
    p_timeframe TEXT DEFAULT 'all',
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
    rank BIGINT,
    user_id BIGINT,
    telegram_id BIGINT,
    total_profit DECIMAL,
    win_rate DECIMAL,
    total_bets BIGINT,
    total_volume DECIMAL,
    biggest_win DECIMAL
) AS $$
DECLARE
    v_start_date TIMESTAMP;
BEGIN
    CASE p_timeframe
        WHEN '24h' THEN v_start_date := NOW() - INTERVAL '24 hours';
        WHEN '7d' THEN v_start_date := NOW() - INTERVAL '7 days';
        WHEN '30d' THEN v_start_date := NOW() - INTERVAL '30 days';
        WHEN 'all' THEN v_start_date := '1970-01-01'::TIMESTAMP;
        ELSE v_start_date := NOW() - INTERVAL '30 days';
    END CASE;
    
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY SUM(CASE WHEN b.won THEN b.payout - b.amount ELSE -b.amount END) DESC) as rank,
        u.id as user_id,
        u."telegramId" as telegram_id,
        SUM(CASE WHEN b.won THEN b.payout - b.amount ELSE -b.amount END) as total_profit,
        CASE 
            WHEN COUNT(b.id) > 0 
            THEN (COUNT(*) FILTER (WHERE b.won = true)::DECIMAL / COUNT(b.id)::DECIMAL * 100)
            ELSE 0 
        END as win_rate,
        COUNT(b.id)::BIGINT as total_bets,
        SUM(b.amount) as total_volume,
        MAX(CASE WHEN b.won THEN b.payout - b.amount ELSE NULL END) as biggest_win
    FROM "User" u
    JOIN "Bet" b ON u.id = b."userId"
    WHERE b."createdAt" >= v_start_date
    GROUP BY u.id, u."telegramId"
    HAVING COUNT(b.id) > 0
    ORDER BY total_profit DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_database_statistics()
RETURNS TABLE(
    total_tables INTEGER,
    total_indexes INTEGER,
    database_size TEXT,
    table_sizes JSONB,
    index_sizes JSONB,
    connection_count INTEGER,
    active_queries INTEGER,
    cache_hit_ratio DECIMAL,
    index_usage_ratio DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public')::INTEGER as total_tables,
        (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public')::INTEGER as total_indexes,
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        (
            SELECT jsonb_agg(jsonb_build_object(
                'table', relname,
                'size', pg_size_pretty(pg_total_relation_size(relid))
            ))
            FROM pg_catalog.pg_statio_user_tables
            ORDER BY pg_total_relation_size(relid) DESC
            LIMIT 10
        ) as table_sizes,
        (
            SELECT jsonb_agg(jsonb_build_object(
                'index', indexrelname,
                'size', pg_size_pretty(pg_relation_size(indexrelid))
            ))
            FROM pg_catalog.pg_stat_user_indexes
            ORDER BY pg_relation_size(indexrelid) DESC
            LIMIT 10
        ) as index_sizes,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::INTEGER as connection_count,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND datname = current_database())::INTEGER as active_queries,
        (
            SELECT 
                CASE 
                    WHEN sum(heap_blks_hit) + sum(heap_blks_read) > 0
                    THEN (sum(heap_blks_hit)::DECIMAL / (sum(heap_blks_hit) + sum(heap_blks_read))::DECIMAL * 100)
                    ELSE 0
                END
            FROM pg_statio_user_tables
        ) as cache_hit_ratio,
        (
            SELECT 
                CASE 
                    WHEN sum(idx_scan) + sum(seq_scan) > 0
                    THEN (sum(idx_scan)::DECIMAL / (sum(idx_scan) + sum(seq_scan))::DECIMAL * 100)
                    ELSE 0
                END
            FROM pg_stat_user_tables
        ) as index_usage_ratio;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DATA ARCHIVAL FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION archive_old_data(
    p_room_retention_days INTEGER DEFAULT 90,
    p_bet_retention_days INTEGER DEFAULT 180,
    p_transaction_retention_days INTEGER DEFAULT 365
)
RETURNS TABLE(
    archived_rooms INTEGER,
    archived_bets INTEGER,
    archived_transactions INTEGER,
    archive_size_mb DECIMAL
) AS $$
DECLARE
    v_archived_rooms INTEGER := 0;
    v_archived_bets INTEGER := 0;
    v_archived_transactions INTEGER := 0;
BEGIN
    -- Archive old settled rooms
    WITH archived AS (
        DELETE FROM "Room"
        WHERE status = 'SETTLED'
        AND "settleTime" < NOW() - (p_room_retention_days || ' days')::INTERVAL
        RETURNING id
    )
    SELECT count(*) INTO v_archived_rooms FROM archived;
    
    -- Archive old bets
    WITH archived AS (
        DELETE FROM "Bet"
        WHERE "createdAt" < NOW() - (p_bet_retention_days || ' days')::INTERVAL
        AND NOT EXISTS (
            SELECT 1 FROM "Room" r 
            WHERE r.id = "Bet"."roomId" 
            AND r.status IN ('OPEN', 'LOCKED')
        )
        RETURNING id
    )
    SELECT count(*) INTO v_archived_bets FROM archived;
    
    -- Archive old transactions
    WITH archived AS (
        DELETE FROM "Transaction"
        WHERE "createdAt" < NOW() - (p_transaction_retention_days || ' days')::INTERVAL
        RETURNING id
    )
    SELECT count(*) INTO v_archived_transactions FROM archived;
    
    RETURN QUERY
    SELECT 
        v_archived_rooms,
        v_archived_bets,
        v_archived_transactions,
        pg_database_size(current_database()) / 1024.0 / 1024.0 as archive_size_mb;
END;
$$ LANGUAGE plpgsql;

