# Callback Handler Reference

This document lists all callback query handlers implemented in the ROOMS bot.

## Dashboard Callbacks

| Callback Data | Handler | Description |
|--------------|---------|-------------|
| `cb:refresh` | `showDashboard` | Refresh dashboard with latest stats |
| `cb:back_dashboard` | `showDashboard` | Return to main dashboard |
| `cb:enter_rooms` | `handleEnterRooms` | Navigate to rooms list |
| `cb:wallet` | `handleWallet` | Open wallet screen |
| `cb:my_bets` | `handleMyBets` | View user's bets |
| `cb:referrals` | `handleReferrals` | View referral stats |
| `cb:rooms_won` | `handleRoomsWon` | View winning history |
| `cb:recent_rooms` | `handleRecentRooms` | View recently joined rooms |
| `cb:rules` | `handleRules` | Display game rules |

## Wallet Callbacks

| Callback Data | Handler | Description |
|--------------|---------|-------------|
| `cb:deposit` | `handleDeposit` | Show deposit instructions |
| `cb:withdraw` | `handleWithdraw` | Initiate withdrawal flow |
| `cb:wallet_history` | `handleWalletHistory` | Show transaction history (page 0) |
| `cb:wallet_history:{page}` | `handleWalletHistory` | Show specific page of history |
| `cb:deposit_confirm` | N/A (stub) | Confirm deposit received |

## Rooms Callbacks

| Callback Data | Handler | Description |
|--------------|---------|-------------|
| `cb:rooms_page:{page}` | `handleEnterRooms` | Navigate to specific page of rooms |
| `cb:room_details:{roomId}` | `handleRoomDetails` | View details of a specific room |
| `cb:join_room:{roomId}:{side}` | `handleJoinRoom` | Initiate bet (LONG or SHORT) |
| `cb:confirm_bet:{roomId}:{side}` | `handleConfirmBet` | Confirm and place bet |

## Bets Callbacks

| Callback Data | Handler | Description |
|--------------|---------|-------------|
| `cb:bets_active` | `handleActiveBets` | View active (unsettled) bets |
| `cb:bets_history` | `handleBetHistory` | View bet history (page 0) |
| `cb:bets_history:{page}` | `handleBetHistory` | View specific page of bet history |

## Utility Callbacks

| Callback Data | Handler | Description |
|--------------|---------|-------------|
| `cb:noop` | N/A | No operation (for display-only buttons) |

## Pattern Matching

The bot uses regex patterns to match callbacks with dynamic parameters:

```typescript
// Wallet history with page number
bot.action(/cb:wallet_history:(\d+)/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  await handleWalletHistory(ctx, page);
});

// Room details with room ID
bot.action(/cb:room_details:(.+)/, async (ctx) => {
  const roomId = ctx.match[1];
  await handleRoomDetails(ctx, roomId);
});

// Join room with ID and side
bot.action(/cb:join_room:(.+):(LONG|SHORT)/, async (ctx) => {
  const roomId = ctx.match[1];
  const side = ctx.match[2] as 'LONG' | 'SHORT';
  await handleJoinRoom(ctx, roomId, side);
});
```

## Adding New Callbacks

To add a new callback handler:

1. **Create the handler function** in the appropriate handler file (e.g., `src/handlers/rooms.ts`)
2. **Register the callback** in `src/index.ts` under `registerCallbacks()`
3. **Add keyboard button** in the appropriate keyboard file (e.g., `src/keyboards/rooms.ts`)
4. **Update this document** with the new callback reference

### Example:

```typescript
// 1. Create handler (src/handlers/rooms.ts)
export async function handleRoomLeaderboard(ctx: Context, roomId: string) {
  // ... implementation
}

// 2. Register callback (src/index.ts)
bot.action(/cb:room_leaderboard:(.+)/, async (ctx) => {
  const roomId = ctx.match[1];
  await handleRoomLeaderboard(ctx, roomId);
});

// 3. Add keyboard button (src/keyboards/rooms.ts)
{
  text: '🏆 Leaderboard',
  callback_data: `cb:room_leaderboard:${roomId}`
}
```

## Best Practices

1. **Naming Convention**: Use `cb:` prefix for all callbacks
2. **Answer Queries**: Always call `ctx.answerCbQuery()` to dismiss loading state
3. **Error Handling**: Wrap handlers in try-catch blocks
4. **Message Editing**: Use `editMessageText` instead of sending new messages
5. **Parameters**: Use `:` as delimiter for multiple parameters
6. **Regex Groups**: Capture dynamic parts with parentheses in regex patterns

