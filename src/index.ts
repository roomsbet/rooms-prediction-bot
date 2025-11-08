/**
 * ROOMS Telegram Bot - Main Entry Point
 * 
 * ============================================================
 * SETUP INSTRUCTIONS
 * ============================================================
 * 
 * 1. Install dependencies:
 *    npm install
 * 
 * 2. Setup environment variables:
 *    Copy env.example to .env and fill in your values:
 *    - TG_BOT_TOKEN: Your Telegram bot token
 *    - DATABASE_URL: PostgreSQL connection string
 *    - SOLANA_RPC_URL: Helius RPC endpoint
 *    - TURNKEY_API_KEY: Turnkey API key for key management
 *    - TURNKEY_ORG_ID: Turnkey organization ID
 *    - TURNKEY_WALLET_ID: Turnkey wallet ID
 * 
 * 3. Setup database:
 *    npm run prisma:generate
 *    npm run prisma:migrate
 * 
 * 4. Run development server:
 *    npm run dev
 * 
 * 5. Production build:
 *    npm run build
 *    npm start
 * 
 * ============================================================
 * ARCHITECTURE
 * ============================================================
 * 
 * - src/handlers/     - Command and callback handlers
 * - src/keyboards/    - Inline keyboard definitions
 * - src/messages/     - Message templates (Markdown)
 * - src/domain/       - Business logic (wallet, rooms, oracle, referrals)
 * - src/infra/        - Infrastructure (Solana, KMS, database)
 * - prisma/           - Database schema and migrations
 * 
 * ============================================================
 */

import { config } from 'dotenv';
import { Telegraf, Context } from 'telegraf';
import { handleStart, showDashboard } from './handlers/start';
import { startDepositMonitor } from './services/depositMonitor';
import { prisma } from './infra/db';
import {
  handleWallet,
  handleDeposit,
  handleWithdraw,
  handleWithdrawSetAddress,
  handleWithdrawAmount,
  handleWithdraw100,
  handleWalletHistory,
  handleShowPrivateKey,
} from './handlers/wallet';
import {
  handleEnterRooms,
  handleRoomDetails,
  handleJoinRoom,
  handleJoinQueue,
  handleConfirmBet,
  handleRecentRooms,
} from './handlers/rooms';
import {
  handleMyBets,
  handleActiveBets,
  handleBetHistory,
} from './handlers/bets';
import { handleReferrals, handleRules } from './handlers/referrals';
import {
  handleAdminCommand,
  showAdminDashboard,
  handleCreateRoom,
  handleSetTitle,
  handleSetMarketType,
  handleSelectMarketType,
  handleSetTargetDate,
  handleSetLockTime,
  handleSetSettleTime,
  handleSetTime,
  handleSetBetLimits,
  handleSetCapacity,
  handleSelectCapacity,
  handleDeployRoom,
  handleListRooms,
  handleUserManagement,
  handleAdminTextInput,
} from './handlers/admin';
import {
  handleUserCreateStart,
  handleUserSetMarket,
  handleUserSelectMarket,
  handleCustomSoon,
  handleUserSetTitle,
  handleUserSetTarget,
  handleUserSetTime,
  handleUserSelectTime,
  handleUserCustomTime,
  handleUserSelectTrackType,
  handleUserDeploy,
  handleUserRoomTextInput,
} from './handlers/userRoomCreation';
import { disconnectDB } from './infra/db';
import { startTimerManager, stopTimerManager } from './utils/timerManager';
import { startSettleRooms, stopSettleRooms } from './jobs/settleRooms';
import { startOracleMonitoring, stopOracleMonitoring } from './jobs/monitorOracles';

// Load environment variables
config();

// Validate required environment variables
function validateEnv() {
  const required = ['TG_BOT_TOKEN', 'DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env file (see env.example)');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

// Initialize bot
function createBot() {
  const token = process.env.TG_BOT_TOKEN!;
  const bot = new Telegraf(token);

  console.log('🤖 Bot initialized');
  return bot;
}

// Register command handlers
function registerCommands(bot: Telegraf) {
  // /start command
  bot.command('start', handleStart);

  // /admin command
  bot.command('admin', handleAdminCommand);

  // Room chat commands (only work in room group chats)
  bot.command('watch', async (ctx) => {
    const { handleWatchCommand } = await import('./handlers/roomChat');
    await handleWatchCommand(ctx);
  });

  bot.command('bet', async (ctx) => {
    const { handleBetCommand } = await import('./handlers/roomChat');
    await handleBetCommand(ctx);
  });

  bot.command('players', async (ctx) => {
    const { handlePlayersCommand } = await import('./handlers/roomChat');
    await handlePlayersCommand(ctx);
  });

  bot.command('oracle', async (ctx) => {
    const { handleOracleCommand } = await import('./handlers/roomChat');
    await handleOracleCommand(ctx);
  });

  bot.command('stats', async (ctx) => {
    const { handleStatsCommand } = await import('./handlers/roomChat');
    await handleStatsCommand(ctx);
  });

  bot.command('help', async (ctx) => {
    const { handleHelpCommand } = await import('./handlers/roomChat');
    await handleHelpCommand(ctx);
  });

  bot.command('taunt', async (ctx) => {
    const { handleTauntCommand } = await import('./handlers/roomChat');
    await handleTauntCommand(ctx);
  });

  // Text message handler for conversation states
  bot.on('text', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const { getUserState, clearUserState } = await import('./utils/conversationState');
    const state = getUserState(telegramId);

    if (!state) return; // No active conversation

    const text = ctx.message.text;

    // Handle admin text input
    const adminActions = ['admin_set_title', 'admin_set_bet_limits', 'admin_set_max_bet',
                          'admin_set_sol_target', 
                          'admin_set_token_ca', 'admin_set_token_symbol', 'admin_set_token_price', 
                          'admin_set_custom_oracle', 'admin_set_target_date',
                          'admin_custom_lock_time', 'admin_custom_settle_time'];
    if (adminActions.includes(state.action as string)) {
      await handleAdminTextInput(ctx, text);
      return;
    }

    // Handle user room creation text input
    const userRoomActions = ['user_room_title', 'user_room_target', 'user_room_token_ca', 'user_room_token_symbol', 'user_room_custom_time', 'user_room_coin_symbol'];
    if (userRoomActions.includes(state.action as string)) {
      await handleUserRoomTextInput(ctx, text);
      return;
    }

    // Handle admin chat add input
    if (state.action === 'admin_chat_add') {
      const { handleAdminChatAddInput } = await import('./handlers/admin');
      await handleAdminChatAddInput(ctx, text);
      return;
    }

    try {
      if (state.action === 'bet_amount') {
        const { handleBetAmountInput } = await import('./handlers/rooms');
        const { roomId, side } = state.data || {};
        
        if (!roomId || !side) {
          await ctx.reply('❌ Error: Session expired. Please try again.');
          clearUserState(telegramId);
          return;
        }
        
        await handleBetAmountInput(ctx, text, roomId, side);
      } else if (state.action === 'withdraw_address') {
        // Validate Solana address (basic check - 32-44 chars)
        if (text.length < 32 || text.length > 44) {
          await ctx.reply('❌ Invalid Solana address. Please try again.');
          return;
        }

        // Delete user's message for privacy
        try {
          await ctx.deleteMessage();
        } catch (e) {
          // Message might be too old to delete
        }

        // Proceed to amount selection
        await handleWithdrawAmount(ctx, text);
      } else if (state.action === 'withdraw_amount') {
        const amount = parseFloat(text);
        
        if (isNaN(amount) || amount <= 0) {
          await ctx.reply('❌ Invalid amount. Please enter a valid number.');
          return;
        }

        // Delete user's message
        try {
          await ctx.deleteMessage();
        } catch (e) {
          // Message might be too old to delete
        }

        // Process withdrawal with entered amount
        const { withdraw } = await import('./domain/wallet');
        const address = state.data?.address;
        
        if (!address) {
          await ctx.reply('❌ Error: Address not found. Please start over.');
          clearUserState(telegramId);
          return;
        }

        await withdraw(telegramId, address, amount);
        clearUserState(telegramId);

        await ctx.reply(`✅ *Withdrawal Successful!*\n\n*Amount:* ${amount.toFixed(4)} SOL\n*To:* \`${address}\`\n\nFunds will arrive shortly.`, {
          parse_mode: 'Markdown',
        });
      }
    } catch (error: any) {
      clearUserState(telegramId);
      await ctx.reply(`❌ ${error.message || 'Withdrawal failed'}`);
    }
  });

  console.log('✅ Command handlers registered');
}

// Register callback query handlers
function registerCallbacks(bot: Telegraf) {
  // Dashboard callbacks
  bot.action('cb:refresh', async (ctx) => {
    try {
      const telegramId = ctx.from?.id;
      if (telegramId) {
        await showDashboard(ctx, telegramId);
      }
    } catch (error: any) {
      // Ignore "message not modified" errors
      if (error.description?.includes('message is not modified')) {
        await ctx.answerCbQuery('Dashboard is already up to date');
      } else {
        console.error('Error refreshing dashboard:', error);
        await ctx.answerCbQuery('❌ Error loading dashboard');
      }
    }
  });

  bot.action('cb:back_dashboard', async (ctx) => {
    try {
      const telegramId = ctx.from?.id;
      if (telegramId) {
        await showDashboard(ctx, telegramId);
      }
    } catch (error: any) {
      // Ignore "message not modified" errors
      if (error.description?.includes('message is not modified')) {
        await ctx.answerCbQuery();
      } else {
        console.error('Error going back to dashboard:', error);
        await ctx.answerCbQuery('❌ Error loading dashboard');
      }
    }
  });

  // New user saved their private key
  bot.action('cb:key_saved', async (ctx) => {
    try {
      const telegramId = ctx.from?.id;
      if (telegramId) {
        await ctx.answerCbQuery('✅ Great! Your key is secured. Welcome to ROOMS!');
        await ctx.deleteMessage(); // Delete the message with private key
        
        // Send dashboard as new message (not edit)
        const user = await prisma.user.findUnique({
          where: { telegramId: BigInt(telegramId) }
        });
        
        if (user) {
          const { formatDashboardMessage } = await import('./messages/dashboard');
          const { getDashboardKeyboard } = await import('./keyboards/dashboard');
          const { getSolPrice } = await import('./infra/price');
          
          const solPrice = await getSolPrice();
          const balance = user.balance.toNumber();
          const usdValue = balance * solPrice;
          const activeRooms = await prisma.room.count({ where: { status: 'OPEN' } });
          
          const message = formatDashboardMessage({
            walletAddress: user.walletAddress,
            balance,
            usdValue,
            activeRooms,
            pnl24h: 0,
            roomsWon24h: 0,
            winRate: 0,
          });
          
          await ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: getDashboardKeyboard(),
          });
        }
      }
    } catch (error) {
      console.error('Error in key_saved handler:', error);
    }
  });

  // Wallet callbacks
  bot.action('cb:wallet', handleWallet);
  bot.action('cb:deposit', handleDeposit);
  bot.action('cb:withdraw', handleWithdraw);
  bot.action('cb:withdraw_set_address', handleWithdrawSetAddress);
  bot.action(/cb:withdraw_100:(.+)/, async (ctx) => {
    const balance = parseFloat(ctx.match[1]);
    await handleWithdraw100(ctx, balance);
  });
  bot.action('cb:show_private_key', handleShowPrivateKey);
  bot.action('cb:wallet_history', (ctx) => handleWalletHistory(ctx, 0));
  bot.action(/cb:wallet_history:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await handleWalletHistory(ctx, page);
  });

  // Rooms callbacks
  bot.action('cb:enter_rooms', (ctx) => handleEnterRooms(ctx, 0));
  bot.action(/cb:rooms_page:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await handleEnterRooms(ctx, page);
  });
  bot.action(/cb:room_details:(.+)/, async (ctx) => {
    const roomId = ctx.match[1];
    await handleRoomDetails(ctx, roomId);
  });
  bot.action(/cb:join_queue:(.+)/, async (ctx) => {
    const roomId = ctx.match[1];
    await handleJoinQueue(ctx, roomId);
  });
  bot.action(/cb:join_room:(.+):(YES|NO)/, async (ctx) => {
    const roomId = ctx.match[1];
    const side = ctx.match[2] as 'YES' | 'NO';
    await handleJoinRoom(ctx, roomId, side);
  });
  bot.action(/cb:confirm_bet:(.+):(YES|NO):(.+)/, async (ctx) => {
    const roomId = ctx.match[1];
    const side = ctx.match[2] as 'YES' | 'NO';
    const amount = parseFloat(ctx.match[3]);
    await handleConfirmBet(ctx, roomId, side, amount);
  });
  bot.action('cb:recent_rooms', handleRecentRooms);
  bot.action(/cb:room_chat:(.+)/, async (ctx) => {
    const { handleViewRoomChat } = await import('./handlers/rooms');
    const roomId = ctx.match[1];
    await handleViewRoomChat(ctx, roomId);
  });

  // Bets callbacks
  bot.action('cb:my_bets', handleMyBets);
  bot.action('cb:bets_active', handleActiveBets);
  bot.action('cb:bets_history', (ctx) => handleBetHistory(ctx, 0));
  bot.action(/cb:bets_history:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await handleBetHistory(ctx, page);
  });
  bot.action('cb:rooms_won', async (ctx) => {
    const { handleRoomsWon } = await import('./handlers/won');
    await handleRoomsWon(ctx, 0);
  });

  // Referrals callbacks
  bot.action('cb:referrals', handleReferrals);
  bot.action('cb:rules', handleRules);

  // Admin callbacks
  bot.action('admin:dashboard', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId) {
      await showAdminDashboard(ctx, telegramId);
    }
  });
  bot.action('admin:refresh', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId) {
      await showAdminDashboard(ctx, telegramId);
    }
  });
  bot.action('admin:create_room', handleCreateRoom);
  bot.action('admin:set_title', handleSetTitle);
  bot.action('admin:set_market_type', handleSetMarketType);
  bot.action(/admin:market_type:(.+)/, async (ctx) => {
    const marketType = ctx.match[1] as 'sol_price' | 'pumpfun_mcap' | 'custom';
    await handleSelectMarketType(ctx, marketType);
  });
  bot.action('admin:set_target_date', handleSetTargetDate);
  bot.action('admin:set_lock_time', handleSetLockTime);
  bot.action('admin:set_settle_time', handleSetSettleTime);
  bot.action(/admin:time_(lock|settle):(\d+)/, async (ctx) => {
    const type = ctx.match[1] as 'lock' | 'settle';
    const minutes = parseInt(ctx.match[2]);
    await handleSetTime(ctx, type, minutes);
  });
  bot.action(/admin:time_(lock|settle):custom/, async (ctx) => {
    const { handleCustomTime } = await import('./handlers/admin');
    const type = ctx.match[1] as 'lock' | 'settle';
    await handleCustomTime(ctx, type);
  });
  bot.action('admin:set_bet_limits', handleSetBetLimits);
  bot.action('admin:set_capacity', handleSetCapacity);
  bot.action(/admin:capacity:(\d+)/, async (ctx) => {
    const capacity = parseInt(ctx.match[1]);
    await handleSelectCapacity(ctx, capacity);
  });
  bot.action('admin:deploy_room', handleDeployRoom);

  // User room creation callbacks
  bot.action('user:create_start', handleUserCreateStart);
  bot.action('user:set_title', handleUserSetTitle);
  bot.action('user:set_market', handleUserSetMarket);
  bot.action(/^user:market:(.+)$/, async (ctx) => {
    const marketType = ctx.match[1];
    await handleUserSelectMarket(ctx, marketType);
  });
  bot.action('user:custom_soon', handleCustomSoon);
  bot.action('user:set_target', handleUserSetTarget);
  bot.action(/^user:track:(.+)$/, async (ctx) => {
    const trackType = ctx.match[1] as 'price' | 'market_cap';
    await handleUserSelectTrackType(ctx, trackType);
  });
  bot.action('user:set_time', handleUserSetTime);
  bot.action(/^user:time:(\d+)$/, async (ctx) => {
    const minutes = ctx.match[1];
    await handleUserSelectTime(ctx, minutes);
  });
  bot.action('user:time:custom', handleUserCustomTime);
  bot.action('user:deploy', handleUserDeploy);
  bot.action('admin:list_rooms', handleListRooms);
  bot.action('admin:stats', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId) {
      await showAdminDashboard(ctx, telegramId);
    }
  });
  bot.action('cb:recent_rooms', handleRecentRooms);
  
  // Rooms Won callback
  bot.action(/won:list:p=(\d+)/, async (ctx) => {
    const { handleRoomsWon } = await import('./handlers/won');
    const page = parseInt(ctx.match[1]) - 1; // Convert to 0-based index
    await handleRoomsWon(ctx, page);
  });

  // Bets callbacks
  bot.action('admin:resolve_markets', async (ctx) => {
    const { handleResolveMarkets } = await import('./handlers/admin');
    await handleResolveMarkets(ctx);
  });
  bot.action(/admin:resolve_room:(\d+)/, async (ctx) => {
    const { handleResolveRoom } = await import('./handlers/admin');
    const roomId = parseInt(ctx.match[1]);
    await handleResolveRoom(ctx, roomId);
  });
  bot.action(/admin:auto_resolve:(\d+)/, async (ctx) => {
    const { handleAutoResolve } = await import('./handlers/admin');
    const roomId = parseInt(ctx.match[1]);
    await handleAutoResolve(ctx, roomId);
  });
  bot.action(/admin:manual_resolve:(.+):(YES|NO)/, async (ctx) => {
    const { handleManualResolve } = await import('./handlers/admin');
    const roomId = ctx.match[1];
    const winningSide = ctx.match[2] as 'YES' | 'NO';
    await handleManualResolve(ctx, roomId, winningSide);
  });
  bot.action('admin:force_settle', async (ctx) => {
    const { handleForceSettle } = await import('./handlers/admin');
    await handleForceSettle(ctx);
  });
  bot.action(/admin:force_settle:(.+)/, async (ctx) => {
    const { handleForceSettleRoom } = await import('./handlers/admin');
    const roomId = ctx.match[1];
    await handleForceSettleRoom(ctx, roomId);
  });

  // Dismiss button - deletes the message
  bot.action('cb:dismiss', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Error deleting message:', error);
      await ctx.answerCbQuery('Message dismissed');
    }
  });

  // No-op callback (for display-only buttons)
  bot.action('cb:noop', async (ctx) => {
    await ctx.answerCbQuery();
  });

  console.log('✅ Callback handlers registered');
}

// Error handling
function registerErrorHandlers(bot: Telegraf) {
  bot.catch((err, ctx) => {
    console.error('❌ Bot error:', err);
    ctx.reply('❌ An error occurred. Please try again later.').catch(console.error);
  });

  console.log('✅ Error handlers registered');
}

// Graceful shutdown
function setupGracefulShutdown(bot: Telegraf) {
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    try {
      // Stop timer manager
      stopTimerManager();
      console.log('✅ Timer manager stopped');
      
      // Stop settlement job
      stopSettleRooms();
      
      // Stop oracle monitoring
      stopOracleMonitoring();
      console.log('✅ Settlement job stopped');
      
      // Stop bot
      bot.stop(signal);
      console.log('✅ Bot stopped');

      // Disconnect database
      await disconnectDB();
      console.log('✅ Database disconnected');

      console.log('👋 Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

// Main function
async function main() {
  console.log('🏛️  ROOMS Bot Starting...\n');

  // Validate environment
  validateEnv();

  // Create bot
  const bot = createBot();

  // Register handlers
  registerCommands(bot);
  registerCallbacks(bot);
  registerErrorHandlers(bot);

  // Setup graceful shutdown
  setupGracefulShutdown(bot);

  // Start deposit monitor webhook server
  startDepositMonitor(3000);

  // Launch bot
  try {
    console.log('🚀 Launching bot...');
    // Delete webhook to ensure polling mode works
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    console.log('✅ Webhook deleted, using polling mode');
    
    // Launch bot (don't await - it hangs but polling works)
    bot.launch();
    console.log('\n🚀 Bot is running!');
    
    // Start timer manager for real-time countdown updates
    startTimerManager(bot);
    
    // Start settlement job (5-second loop)
    startSettleRooms(bot);
    
    // Start oracle monitoring job (10-second loop for instant settlement)
    startOracleMonitoring(bot);
    
    console.log('Press Ctrl+C to stop\n');
  } catch (error) {
    console.error('❌ Failed to launch bot:', error);
    process.exit(1);
  }
}

// Run the bot
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

