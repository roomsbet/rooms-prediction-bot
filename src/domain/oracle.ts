/**
 * Oracle Domain - Market Resolution Logic
 * Integrates with Switchboard (on-chain) and Solscan API for price data
 */

import { getSolPrice, getSolPriceFromSwitchboard, getTokenMarketData, getCoinPrice } from '../infra/price';

export interface MarketResolutionResult {
  resolved: boolean;
  winningSide: 'YES' | 'NO' | null;
  actualValue: number | null;
  message: string;
}

/**
 * Resolve coin price market (universal - works for any cryptocurrency)
 * Example: "Will BTC cross $100,000 by Dec 31, 2024?"
 */
export async function resolveCoinPriceMarket(
  coinSymbol: string,
  targetPrice: number,
  targetDate: Date
): Promise<MarketResolutionResult> {
  try {
    const now = new Date();
    
    // Check if target date has passed
    if (now < targetDate) {
      return {
        resolved: false,
        winningSide: null,
        actualValue: null,
        message: 'Market has not reached target date yet',
      };
    }
    
    // Fetch current coin price using universal API
    const currentPrice = await getCoinPrice(coinSymbol);
    
    if (currentPrice === 0) {
      throw new Error(`Failed to fetch ${coinSymbol} price from all sources`);
    }
    
    // Determine winner: YES wins if price reached or exceeded target
    const winningSide = currentPrice >= targetPrice ? 'YES' : 'NO';
    
    return {
      resolved: true,
      winningSide,
      actualValue: currentPrice,
      message: `${coinSymbol} price: $${currentPrice.toFixed(2)} (target: $${targetPrice.toFixed(2)})`,
    };
  } catch (error) {
    console.error(`Error resolving ${coinSymbol} price market:`, error);
    return {
      resolved: false,
      winningSide: null,
      actualValue: null,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Resolve SOL price market (legacy - uses resolveCoinPriceMarket internally)
 * Example: "Will SOL cross $170 by Dec 31, 2024?"
 */
export async function resolvesolpriceMarket(
  targetPrice: number,
  targetDate: Date
): Promise<MarketResolutionResult> {
  return resolveCoinPriceMarket('SOL', targetPrice, targetDate);
}

/**
 * Resolve Pump.fun token market cap market
 * Example: "Will [TOKEN] reach $10M market cap by Jan 15, 2025?"
 */
export async function resolvePumpfunMarket(
  tokenAddress: string,
  targetMarketCap: number,
  targetDate: Date
): Promise<MarketResolutionResult> {
  try {
    const now = new Date();
    
    // Check if target date has passed
    if (now < targetDate) {
      return {
        resolved: false,
        winningSide: null,
        actualValue: null,
        message: 'Market has not reached target date yet',
      };
    }
    
    // Fetch token market data
    const tokenData = await getTokenMarketData(tokenAddress);
    
    if (!tokenData) {
      throw new Error('Failed to fetch token market data');
    }
    
    const { marketCap } = tokenData;
    
    // Determine winner: YES wins if market cap reached or exceeded target
    const winningSide = marketCap >= targetMarketCap ? 'YES' : 'NO';
    
    return {
      resolved: true,
      winningSide,
      actualValue: marketCap,
      message: `Market cap: $${(marketCap / 1_000_000).toFixed(2)}M (target: $${(targetMarketCap / 1_000_000).toFixed(2)}M)`,
    };
  } catch (error) {
    console.error('Error resolving Pump.fun market:', error);
    return {
      resolved: false,
      winningSide: null,
      actualValue: null,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Resolve custom market (manual resolution by admin)
 */
export async function resolveCustomMarket(
  adminDecision: 'YES' | 'NO'
): Promise<MarketResolutionResult> {
  return {
    resolved: true,
    winningSide: adminDecision,
    actualValue: null,
    message: `Manually resolved by admin: ${adminDecision} wins`,
  };
}

/**
 * Check if a market can be auto-resolved
 */
export async function canAutoResolve(
  marketType: string,
  targetDate: Date
): Promise<boolean> {
  const now = new Date();
  
  // Market can only be resolved after target date
  if (now < targetDate) {
    return false;
  }
  
  // Custom markets require manual resolution
  if (marketType === 'custom') {
    return false;
  }
  
  // Coin price and Pump.fun markets can be auto-resolved
  return ['solprice', 'sol_price', 'coin_price', 'coin_mcap', 'pumpfun_mcap'].includes(marketType);
}

