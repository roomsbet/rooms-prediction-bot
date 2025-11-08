-- ROOMS Database Maintenance Scripts
-- Trusted by Helius • Powered by Turnkey

-- Cleanup old settled rooms
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS void AS $$
BEGIN
    DELETE FROM "Room" 
    WHERE status = 'SETTLED' 
    AND "settleTime" < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Update room statistics
CREATE OR REPLACE FUNCTION update_room_stats()
RETURNS void AS $$
BEGIN
    UPDATE "Room" r
    SET "currentPlayers" = (
        SELECT COUNT(DISTINCT "userId")
        FROM "Bet"
        WHERE "roomId" = r.id AND status = 'ACTIVE'
    )
    WHERE status IN ('OPEN', 'LOCKED');
END;
$$ LANGUAGE plpgsql;

-- Calculate user lifetime stats
CREATE OR REPLACE FUNCTION calculate_user_stats(user_id BIGINT)
RETURNS TABLE(
    total_bets BIGINT,
    total_wins BIGINT,
    total_profit DECIMAL,
    win_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_bets,
        COUNT(*) FILTER (WHERE won = true)::BIGINT as total_wins,
        COALESCE(SUM(CASE WHEN won THEN payout - amount ELSE -amount END), 0) as total_profit,
        CASE 
            WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE won = true)::DECIMAL / COUNT(*)::DECIMAL * 100)
            ELSE 0
        END as win_rate
    FROM "Bet"
    WHERE "userId" = user_id;
END;
$$ LANGUAGE plpgsql;

