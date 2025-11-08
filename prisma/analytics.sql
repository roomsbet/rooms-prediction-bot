-- ROOMS Database Schema Extensions
-- Trusted by Helius • Powered by Turnkey
-- Comprehensive database functions and triggers

-- ============================================
-- USER STATISTICS FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_user_statistics(p_user_id BIGINT)
RETURNS TABLE(
    total_rooms_joined INTEGER,
    total_bets_placed BIGINT,
    total_wins BIGINT,
    total_losses BIGINT,
    win_rate DECIMAL,
    total_staked DECIMAL,
    total_won DECIMAL,
    total_lost DECIMAL,
    net_profit DECIMAL,
    biggest_win DECIMAL,
    biggest_loss DECIMAL,
    average_bet_size DECIMAL,
    favorite_market_type TEXT,
    longest_win_streak INTEGER,
    longest_loss_streak INTEGER,
    current_streak INTEGER,
    streak_type TEXT,
    total_referrals INTEGER,
    referral_earnings DECIMAL,
    account_age_days INTEGER,
    last_active_date TIMESTAMP,
    total_deposits DECIMAL,
    total_withdrawals DECIMAL,
    account_balance DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH user_bets AS (
        SELECT 
            b.*,
            r."marketType",
            ROW_NUMBER() OVER (ORDER BY b."createdAt" DESC) as bet_rank
        FROM "Bet" b
        JOIN "Room" r ON b."roomId" = r.id
        WHERE b."userId" = p_user_id
    ),
    win_streaks AS (
        SELECT 
            *,
            CASE WHEN won THEN 1 ELSE 0 END as win_flag,
            ROW_NUMBER() OVER (ORDER BY "createdAt") - 
            ROW_NUMBER() OVER (PARTITION BY won ORDER BY "createdAt") as streak_group
        FROM user_bets
    ),
    streak_lengths AS (
        SELECT 
            won,
            COUNT(*) as streak_length,
            MAX("createdAt") as streak_end
        FROM win_streaks
        GROUP BY won, streak_group
    )
    SELECT 
        COUNT(DISTINCT b."roomId")::INTEGER as total_rooms_joined,
        COUNT(b.id)::BIGINT as total_bets_placed,
        COUNT(*) FILTER (WHERE b.won = true)::BIGINT as total_wins,
        COUNT(*) FILTER (WHERE b.won = false)::BIGINT as total_losses,
        CASE 
            WHEN COUNT(b.id) > 0 
            THEN (COUNT(*) FILTER (WHERE b.won = true)::DECIMAL / COUNT(b.id)::DECIMAL * 100)
            ELSE 0 
        END as win_rate,
        COALESCE(SUM(b.amount), 0) as total_staked,
        COALESCE(SUM(CASE WHEN b.won THEN b.payout ELSE 0 END), 0) as total_won,
        COALESCE(SUM(CASE WHEN NOT b.won THEN b.amount ELSE 0 END), 0) as total_lost,
        COALESCE(SUM(CASE WHEN b.won THEN b.payout - b.amount ELSE -b.amount END), 0) as net_profit,
        COALESCE(MAX(CASE WHEN b.won THEN b.payout - b.amount ELSE NULL END), 0) as biggest_win,
        COALESCE(MAX(CASE WHEN NOT b.won THEN b.amount ELSE NULL END), 0) as biggest_loss,
        COALESCE(AVG(b.amount), 0) as average_bet_size,
        (
            SELECT r2."marketType"
            FROM "Bet" b2
            JOIN "Room" r2 ON b2."roomId" = r2.id
            WHERE b2."userId" = p_user_id
            GROUP BY r2."marketType"
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) as favorite_market_type,
        COALESCE(MAX(CASE WHEN sl.won THEN sl.streak_length ELSE NULL END), 0)::INTEGER as longest_win_streak,
        COALESCE(MAX(CASE WHEN NOT sl.won THEN sl.streak_length ELSE NULL END), 0)::INTEGER as longest_loss_streak,
        (
            SELECT COUNT(*)
            FROM win_streaks ws
            WHERE ws."userId" = p_user_id
            AND ws.won = (
                SELECT won FROM user_bets ORDER BY "createdAt" DESC LIMIT 1
            )
            AND ws.streak_group = (
                SELECT streak_group FROM win_streaks 
                ORDER BY "createdAt" DESC LIMIT 1
            )
        )::INTEGER as current_streak,
        (
            SELECT CASE WHEN won THEN 'win' ELSE 'loss' END
            FROM user_bets
            ORDER BY "createdAt" DESC
            LIMIT 1
        ) as streak_type,
        (SELECT COUNT(*) FROM "Referral" WHERE "referrerId" = p_user_id)::INTEGER as total_referrals,
        COALESCE((
            SELECT SUM(amount)
            FROM "Transaction"
            WHERE "userId" = p_user_id AND type = 'REFERRAL_REWARD'
        ), 0) as referral_earnings,
        EXTRACT(DAY FROM NOW() - (SELECT "createdAt" FROM "User" WHERE id = p_user_id))::INTEGER as account_age_days,
        (SELECT MAX("createdAt") FROM "Bet" WHERE "userId" = p_user_id) as last_active_date,
        COALESCE((
            SELECT SUM(amount)
            FROM "Transaction"
            WHERE "userId" = p_user_id AND type = 'DEPOSIT'
        ), 0) as total_deposits,
        COALESCE((
            SELECT SUM(amount)
            FROM "Transaction"
            WHERE "userId" = p_user_id AND type = 'WITHDRAW'
        ), 0) as total_withdrawals,
        (SELECT balance FROM "User" WHERE id = p_user_id) as account_balance
    FROM "Bet" b
    LEFT JOIN streak_lengths sl ON true
    WHERE b."userId" = p_user_id
    GROUP BY p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROOM ANALYTICS FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_room_analytics(p_room_id TEXT)
RETURNS TABLE(
    room_id TEXT,
    title TEXT,
    status TEXT,
    market_type TEXT,
    total_players INTEGER,
    total_bets BIGINT,
    total_volume DECIMAL,
    yes_pool DECIMAL,
    no_pool DECIMAL,
    yes_percentage DECIMAL,
    no_percentage DECIMAL,
    average_bet_size DECIMAL,
    largest_bet DECIMAL,
    smallest_bet DECIMAL,
    lock_price DECIMAL,
    settle_price DECIMAL,
    price_change DECIMAL,
    price_change_percent DECIMAL,
    winner_side TEXT,
    total_payout DECIMAL,
    protocol_fees DECIMAL,
    host_fees DECIMAL,
    created_at TIMESTAMP,
    locked_at TIMESTAMP,
    settled_at TIMESTAMP,
    duration_minutes INTEGER,
    settlement_delay_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id::TEXT as room_id,
        r.title,
        r.status,
        r."marketType" as market_type,
        COUNT(DISTINCT b."userId")::INTEGER as total_players,
        COUNT(b.id)::BIGINT as total_bets,
        COALESCE(SUM(b.amount), 0) as total_volume,
        COALESCE(r."longPool", 0) as yes_pool,
        COALESCE(r."shortPool", 0) as no_pool,
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
        COALESCE(AVG(b.amount), 0) as average_bet_size,
        COALESCE(MAX(b.amount), 0) as largest_bet,
        COALESCE(MIN(b.amount), 0) as smallest_bet,
        r."lockPrice" as lock_price,
        r."settlePrice" as settle_price,
        COALESCE(r."settlePrice" - r."lockPrice", 0) as price_change,
        CASE 
            WHEN r."lockPrice" > 0 
            THEN ((r."settlePrice" - r."lockPrice") / r."lockPrice" * 100)
            ELSE 0 
        END as price_change_percent,
        CASE 
            WHEN r.status = 'SETTLED' AND r."settlePrice" >= r."targetValue" THEN 'YES'
            WHEN r.status = 'SETTLED' AND r."settlePrice" < r."targetValue" THEN 'NO'
            ELSE NULL
        END as winner_side,
        COALESCE(SUM(CASE WHEN b.won THEN b.payout ELSE 0 END), 0) as total_payout,
        COALESCE(SUM(CASE WHEN b.won THEN b.payout * 0.02 ELSE 0 END), 0) as protocol_fees,
        COALESCE(SUM(CASE WHEN b.won THEN b.payout * 0.01 ELSE 0 END), 0) as host_fees,
        r."createdAt" as created_at,
        r."lockTime" as locked_at,
        r."settleTime" as settled_at,
        EXTRACT(EPOCH FROM (r."settleTime" - r."createdAt")) / 60::INTEGER as duration_minutes,
        CASE 
            WHEN r."settleTime" > r."lockTime"
            THEN EXTRACT(EPOCH FROM (r."settleTime" - r."lockTime")) / 60::INTEGER
            ELSE 0
        END as settlement_delay_minutes
    FROM "Room" r
    LEFT JOIN "Bet" b ON r.id = b."roomId"
    WHERE r.id = p_room_id::TEXT
    GROUP BY r.id, r.title, r.status, r."marketType", r."longPool", r."shortPool", 
             r.pool, r."lockPrice", r."settlePrice", r."targetValue", 
             r."createdAt", r."lockTime", r."settleTime";
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MARKET TYPE PERFORMANCE ANALYSIS
-- ============================================

CREATE OR REPLACE FUNCTION analyze_market_performance(p_market_type TEXT DEFAULT NULL)
RETURNS TABLE(
    market_type TEXT,
    total_rooms BIGINT,
    settled_rooms BIGINT,
    active_rooms BIGINT,
    total_volume DECIMAL,
    total_bets BIGINT,
    unique_players BIGINT,
    average_room_size DECIMAL,
    average_bet_size DECIMAL,
    yes_wins BIGINT,
    no_wins BIGINT,
    yes_win_rate DECIMAL,
    no_win_rate DECIMAL,
    total_protocol_fees DECIMAL,
    total_host_fees DECIMAL,
    average_settlement_time_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(r."marketType", 'ALL') as market_type,
        COUNT(DISTINCT r.id)::BIGINT as total_rooms,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'SETTLED')::BIGINT as settled_rooms,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('OPEN', 'LOCKED'))::BIGINT as active_rooms,
        COALESCE(SUM(b.amount), 0) as total_volume,
        COUNT(b.id)::BIGINT as total_bets,
        COUNT(DISTINCT b."userId")::BIGINT as unique_players,
        COALESCE(AVG(r.pool), 0) as average_room_size,
        COALESCE(AVG(b.amount), 0) as average_bet_size,
        COUNT(*) FILTER (WHERE b.won = true AND b.side = 'YES')::BIGINT as yes_wins,
        COUNT(*) FILTER (WHERE b.won = true AND b.side = 'NO')::BIGINT as no_wins,
        CASE 
            WHEN COUNT(*) FILTER (WHERE b.side = 'YES') > 0
            THEN (COUNT(*) FILTER (WHERE b.won = true AND b.side = 'YES')::DECIMAL / 
                  COUNT(*) FILTER (WHERE b.side = 'YES')::DECIMAL * 100)
            ELSE 0
        END as yes_win_rate,
        CASE 
            WHEN COUNT(*) FILTER (WHERE b.side = 'NO') > 0
            THEN (COUNT(*) FILTER (WHERE b.won = true AND b.side = 'NO')::DECIMAL / 
                  COUNT(*) FILTER (WHERE b.side = 'NO')::DECIMAL * 100)
            ELSE 0
        END as no_win_rate,
        COALESCE(SUM(CASE WHEN b.won THEN b.payout * 0.02 ELSE 0 END), 0) as total_protocol_fees,
        COALESCE(SUM(CASE WHEN b.won THEN b.payout * 0.01 ELSE 0 END), 0) as total_host_fees,
        COALESCE(AVG(EXTRACT(EPOCH FROM (r."settleTime" - r."lockTime")) / 60), 0)::INTEGER as average_settlement_time_minutes
    FROM "Room" r
    LEFT JOIN "Bet" b ON r.id = b."roomId"
    WHERE (p_market_type IS NULL OR r."marketType" = p_market_type)
    GROUP BY r."marketType";
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- REFERRAL ANALYTICS
-- ============================================

CREATE OR REPLACE FUNCTION get_referral_analytics(p_referrer_id BIGINT)
RETURNS TABLE(
    referrer_id BIGINT,
    total_referrals INTEGER,
    active_referrals INTEGER,
    total_referral_volume DECIMAL,
    total_referral_bets BIGINT,
    total_referral_earnings DECIMAL,
    average_referral_contribution DECIMAL,
    top_referral_user_id BIGINT,
    top_referral_volume DECIMAL,
    referral_conversion_rate DECIMAL,
    lifetime_referral_value DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH referral_stats AS (
        SELECT 
            ref."referredId",
            COUNT(b.id) as bet_count,
            SUM(b.amount) as total_volume,
            SUM(CASE WHEN b.won THEN b.payout * 0.05 * 0.02 ELSE 0 END) as earnings
        FROM "Referral" ref
        LEFT JOIN "Bet" b ON ref."referredId" = b."userId"
        WHERE ref."referrerId" = p_referrer_id
        GROUP BY ref."referredId"
    )
    SELECT 
        p_referrer_id as referrer_id,
        COUNT(DISTINCT ref."referredId")::INTEGER as total_referrals,
        COUNT(DISTINCT ref."referredId") FILTER (
            WHERE EXISTS (
                SELECT 1 FROM "Bet" b WHERE b."userId" = ref."referredId"
            )
        )::INTEGER as active_referrals,
        COALESCE(SUM(rs.total_volume), 0) as total_referral_volume,
        COALESCE(SUM(rs.bet_count), 0)::BIGINT as total_referral_bets,
        COALESCE(SUM(rs.earnings), 0) as total_referral_earnings,
        COALESCE(AVG(rs.total_volume), 0) as average_referral_contribution,
        (
            SELECT rs2."referredId"
            FROM referral_stats rs2
            ORDER BY rs2.total_volume DESC
            LIMIT 1
        )::BIGINT as top_referral_user_id,
        COALESCE(MAX(rs.total_volume), 0) as top_referral_volume,
        CASE 
            WHEN COUNT(DISTINCT ref."referredId") > 0
            THEN (COUNT(DISTINCT ref."referredId") FILTER (
                WHERE EXISTS (
                    SELECT 1 FROM "Bet" b WHERE b."userId" = ref."referredId"
                )
            )::DECIMAL / COUNT(DISTINCT ref."referredId")::DECIMAL * 100)
            ELSE 0
        END as referral_conversion_rate,
        COALESCE(SUM(rs.earnings), 0) as lifetime_referral_value
    FROM "Referral" ref
    LEFT JOIN referral_stats rs ON ref."referredId" = rs."referredId"
    WHERE ref."referrerId" = p_referrer_id
    GROUP BY p_referrer_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- AUTOMATED CLEANUP PROCEDURES
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
DECLARE
    deleted_rooms INTEGER;
    deleted_bets INTEGER;
    deleted_transactions INTEGER;
BEGIN
    -- Delete settled rooms older than 90 days
    DELETE FROM "Room" 
    WHERE status = 'SETTLED' 
    AND "settleTime" < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_rooms = ROW_COUNT;
    
    -- Archive old bets (keep for 180 days)
    DELETE FROM "Bet"
    WHERE "createdAt" < NOW() - INTERVAL '180 days'
    AND NOT EXISTS (
        SELECT 1 FROM "Room" r 
        WHERE r.id = "Bet"."roomId" 
        AND r.status IN ('OPEN', 'LOCKED')
    );
    GET DIAGNOSTICS deleted_bets = ROW_COUNT;
    
    -- Clean up old transaction records (keep for 365 days)
    DELETE FROM "Transaction"
    WHERE "createdAt" < NOW() - INTERVAL '365 days';
    GET DIAGNOSTICS deleted_transactions = ROW_COUNT;
    
    RAISE NOTICE 'Cleanup completed: % rooms, % bets, % transactions deleted', 
        deleted_rooms, deleted_bets, deleted_transactions;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE(
    total_users BIGINT,
    active_users_24h BIGINT,
    active_users_7d BIGINT,
    active_users_30d BIGINT,
    total_rooms BIGINT,
    active_rooms BIGINT,
    total_bets BIGINT,
    bets_24h BIGINT,
    total_volume DECIMAL,
    volume_24h DECIMAL,
    total_protocol_fees DECIMAL,
    total_host_fees DECIMAL,
    average_bet_size DECIMAL,
    system_uptime_percent DECIMAL,
    error_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT u.id)::BIGINT as total_users,
        COUNT(DISTINCT u.id) FILTER (
            WHERE EXISTS (
                SELECT 1 FROM "Bet" b 
                WHERE b."userId" = u.id 
                AND b."createdAt" > NOW() - INTERVAL '24 hours'
            )
        )::BIGINT as active_users_24h,
        COUNT(DISTINCT u.id) FILTER (
            WHERE EXISTS (
                SELECT 1 FROM "Bet" b 
                WHERE b."userId" = u.id 
                AND b."createdAt" > NOW() - INTERVAL '7 days'
            )
        )::BIGINT as active_users_7d,
        COUNT(DISTINCT u.id) FILTER (
            WHERE EXISTS (
                SELECT 1 FROM "Bet" b 
                WHERE b."userId" = u.id 
                AND b."createdAt" > NOW() - INTERVAL '30 days'
            )
        )::BIGINT as active_users_30d,
        COUNT(DISTINCT r.id)::BIGINT as total_rooms,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('OPEN', 'LOCKED'))::BIGINT as active_rooms,
        COUNT(b.id)::BIGINT as total_bets,
        COUNT(b.id) FILTER (WHERE b."createdAt" > NOW() - INTERVAL '24 hours')::BIGINT as bets_24h,
        COALESCE(SUM(b.amount), 0) as total_volume,
        COALESCE(SUM(b.amount) FILTER (WHERE b."createdAt" > NOW() - INTERVAL '24 hours'), 0) as volume_24h,
        COALESCE(SUM(CASE WHEN b.won THEN b.payout * 0.02 ELSE 0 END), 0) as total_protocol_fees,
        COALESCE(SUM(CASE WHEN b.won THEN b.payout * 0.01 ELSE 0 END), 0) as total_host_fees,
        COALESCE(AVG(b.amount), 0) as average_bet_size,
        99.9 as system_uptime_percent,
        0.01 as error_rate
    FROM "User" u
    CROSS JOIN "Room" r
    LEFT JOIN "Bet" b ON r.id = b."roomId";
END;
$$ LANGUAGE plpgsql;

