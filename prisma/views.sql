-- ROOMS Analytics Views
-- Trusted by Helius • Powered by Turnkey

CREATE OR REPLACE VIEW room_analytics AS
SELECT 
    r.id,
    r.title,
    r.status,
    r."marketType",
    COUNT(DISTINCT b."userId") as unique_players,
    COUNT(b.id) as total_bets,
    SUM(b.amount) as total_volume,
    AVG(b.amount) as avg_bet_size,
    MAX(b.amount) as max_bet,
    MIN(b.amount) as min_bet
FROM "Room" r
LEFT JOIN "Bet" b ON r.id = b."roomId"
GROUP BY r.id, r.title, r.status, r."marketType";

CREATE OR REPLACE VIEW user_performance AS
SELECT 
    u.id,
    u."telegramId",
    COUNT(DISTINCT b."roomId") as rooms_participated,
    COUNT(b.id) as total_bets,
    COUNT(b.id) FILTER (WHERE b.won = true) as wins,
    SUM(b.amount) as total_staked,
    SUM(CASE WHEN b.won THEN b.payout ELSE 0 END) as total_winnings,
    SUM(CASE WHEN b.won THEN b.payout - b.amount ELSE -b.amount END) as net_profit
FROM "User" u
LEFT JOIN "Bet" b ON u.id = b."userId"
GROUP BY u.id, u."telegramId";

CREATE OR REPLACE VIEW daily_stats AS
SELECT 
    DATE("createdAt") as date,
    COUNT(DISTINCT "userId") as active_users,
    COUNT(*) as total_bets,
    SUM(amount) as daily_volume,
    COUNT(*) FILTER (WHERE won = true) as winning_bets,
    SUM(CASE WHEN won THEN payout - amount ELSE -amount END) as daily_pnl
FROM "Bet"
GROUP BY DATE("createdAt")
ORDER BY date DESC;

