/**
 * Price Feed Infrastructure
 * Fetches current SOL/USD price from Switchboard (on-chain oracle)
 * and token data from Solscan API
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { CrossbarClient } from '@switchboard-xyz/on-demand';

interface PriceData {
  solUsd: number;
  timestamp: number;
}

interface SolscanMarketResponse {
  success: boolean;
  data: {
    priceUsdt: string;
    volume24h: string;
    marketCapFD?: string;
  };
}

let cachedPrice: PriceData = {
  solUsd: 0,
  timestamp: 0,
};

const CACHE_TTL = 60000; // 1 minute
const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY || '';

// Switchboard SOL/USD feed address (mainnet & devnet)
// This is the official Switchboard SOL/USD price feed
const SOL_USD_FEED = new PublicKey('GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR');

/**
 * Fetch current SOL/USD price from Solscan
 */
export async function getSolPrice(): Promise<number> {
  const now = Date.now();
  
  // Return cached price if fresh
  if (cachedPrice.timestamp > now - CACHE_TTL && cachedPrice.solUsd > 0) {
    return cachedPrice.solUsd;
  }
  
  try {
    // Solscan API v2 endpoint for SOL market data
    const response = await fetch(
      'https://pro-api.solscan.io/v2.0/token/meta?address=So11111111111111111111111111111111111111112',
      {
        headers: {
          'Authorization': `Bearer ${SOLSCAN_API_KEY}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Solscan API error: ${response.status}`);
    }
    
    const data: SolscanMarketResponse = await response.json();
    const price = parseFloat(data.data?.priceUsdt || '0');
    
    if (price > 0) {
      cachedPrice = {
        solUsd: price,
        timestamp: now,
      };
    }
    
    return price;
  } catch (error) {
    console.error('Error fetching SOL price from Solscan:', error);
    // Fallback to CoinGecko if Solscan fails
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      if (response.ok) {
        const data = await response.json();
        const price = data.solana?.usd || 0;
        if (price > 0) {
          cachedPrice = { solUsd: price, timestamp: now };
        }
        return price;
      }
    } catch (fallbackError) {
      console.error('CoinGecko fallback also failed:', fallbackError);
    }
    
    // Return cached price even if stale, or 0
    return cachedPrice.solUsd || 0;
  }
}

/**
 * Fetch SOL/USD price from Switchboard on-chain oracle
 * More reliable for production use as it's decentralized and on-chain
 */
export async function getSolPriceFromSwitchboard(): Promise<number> {
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl);
    
    // Create Crossbar client for Switchboard
    const crossbar = new CrossbarClient('https://crossbar.switchboard.xyz');
    
    // Fetch the feed data
    const feeds = await crossbar.fetchAllPullFeeds({
      feedHashes: [SOL_USD_FEED.toBuffer()],
    });
    
    if (feeds && feeds.length > 0) {
      const solFeed = feeds[0];
      const price = solFeed.value || 0;
      
      console.log(`Switchboard SOL/USD: $${price.toFixed(2)}`);
      
      // Update cache
      const now = Date.now();
      if (price > 0) {
        cachedPrice = {
          solUsd: price,
          timestamp: now,
        };
      }
      
      return price;
    }
    
    throw new Error('No feed data returned from Switchboard');
  } catch (error) {
    console.error('Error fetching SOL price from Switchboard:', error);
    // Fallback to Solscan/CoinGecko
    return await getSolPrice();
  }
}

/**
 * Fetch token market data from DexScreener (works great for Pump.fun tokens)
 */
export async function getTokenMarketData(tokenAddress: string): Promise<{
  price: number;
  marketCap: number;
  symbol: string;
} | null> {
  try {
    // DexScreener API - free and reliable
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Get the first pair (usually Raydium or Pump.fun)
    if (!data.pairs || data.pairs.length === 0) {
      throw new Error('No trading pairs found for this token');
    }
    
    const pair = data.pairs[0];
    
    return {
      price: parseFloat(pair.priceUsd || '0'),
      marketCap: parseFloat(pair.marketCap || '0'),
      symbol: pair.baseToken?.symbol || '',
    };
  } catch (error) {
    console.error(`Error fetching token data for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Format USD value
 */
export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * Format market cap value
 */
export function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Validate and get coin information by symbol
 * Uses CryptoCompare API to identify coins
 */
export async function validateCoinSymbol(symbol: string): Promise<{
  id: string;
  symbol: string;
  name: string;
} | null> {
  try {
    const upperSymbol = symbol.toUpperCase().trim();
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY || '';
    
    // Try CryptoCompare first (fastest, real-time)
    if (apiKey) {
      try {
        const response = await fetch(
          `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${upperSymbol}&tsyms=USD`,
          {
            headers: {
              'Authorization': `Apikey ${apiKey}`,
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.RAW && data.RAW[upperSymbol] && data.RAW[upperSymbol].USD) {
            const coinData = data.RAW[upperSymbol].USD;
            return {
              id: upperSymbol,
              symbol: upperSymbol,
              name: coinData.FROMSYMBOL || upperSymbol,
            };
          }
        }
      } catch (error) {
        console.error('CryptoCompare validation failed:', error);
      }
    }
    
    // Fallback to CoinGecko
    const geckoResponse = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`
    );
    
    if (geckoResponse.ok) {
      const geckoData = await geckoResponse.json();
      if (geckoData.coins && geckoData.coins.length > 0) {
        const coin = geckoData.coins[0];
        return {
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error validating coin symbol ${symbol}:`, error);
    return null;
  }
}

/**
 * Get real-time price for any cryptocurrency
 * Uses CryptoCompare (fastest) with Binance/CoinGecko fallback
 */
export async function getCoinPrice(symbol: string): Promise<number> {
  const upperSymbol = symbol.toUpperCase().trim();
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY || '';
  
  // Try CryptoCompare first (real-time, sub-second updates)
  if (apiKey) {
    try {
      const response = await fetch(
        `https://min-api.cryptocompare.com/data/price?fsym=${upperSymbol}&tsyms=USD`,
        {
          headers: {
            'Authorization': `Apikey ${apiKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.USD && data.USD > 0) {
          return data.USD;
        }
      }
    } catch (error) {
      console.error('CryptoCompare API failed:', error);
    }
  }
  
  // Fallback 1: Binance API (real-time, but only Binance-listed coins)
  try {
    const binanceResponse = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${upperSymbol}USDT`
    );
    
    if (binanceResponse.ok) {
      const binanceData = await binanceResponse.json();
      if (binanceData.price) {
        return parseFloat(binanceData.price);
      }
    }
  } catch (error) {
    // Binance might not have this pair, continue to next fallback
  }
  
  // Fallback 2: CoinGecko (slower but comprehensive)
  try {
    const coinInfo = await validateCoinSymbol(symbol);
    if (coinInfo) {
      const geckoResponse = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinInfo.id}&vs_currencies=usd`
      );
      
      if (geckoResponse.ok) {
        const geckoData = await geckoResponse.json();
        if (geckoData[coinInfo.id]?.usd) {
          return geckoData[coinInfo.id].usd;
        }
      }
    }
  } catch (error) {
    console.error('CoinGecko fallback failed:', error);
  }
  
  // Last resort: return 0 if all fail
  console.error(`Failed to fetch price for ${upperSymbol} from all sources`);
  return 0;
}

