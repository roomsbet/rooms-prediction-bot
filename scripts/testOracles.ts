/**
 * Quick test of oracle endpoints
 */
import { getSolPrice, getTokenMarketData } from '../src/infra/price';

async function testOracles() {
  console.log('Testing oracles...\n');

  // Test SOL price
  try {
    const solPrice = await getSolPrice();
    console.log(`✅ SOL Price: $${solPrice.toFixed(2)}`);
  } catch (error) {
    console.error(`❌ SOL Price failed:`, error);
  }

  // Test MONEROCHAN token
  try {
    const tokenData = await getTokenMarketData('H5b4iYiZYycr7fmQ1dMj7hdfLGAEPcDH261K4hugpump');
    if (tokenData) {
      console.log(`✅ MONEROCHAN: $${(tokenData.marketCap / 1_000_000).toFixed(2)}M market cap`);
    } else {
      console.log(`⚠️ MONEROCHAN: No data found`);
    }
  } catch (error) {
    console.error(`❌ MONEROCHAN failed:`, error);
  }

  // Test SPSN token
  try {
    const tokenData = await getTokenMarketData('Sg4k4iFaEeqhv5866cQmsFTMhRx8sVCPAq2j8Xcpump');
    if (tokenData) {
      console.log(`✅ SPSN: $${(tokenData.marketCap / 1_000_000).toFixed(2)}M market cap`);
    } else {
      console.log(`⚠️ SPSN: No data found`);
    }
  } catch (error) {
    console.error(`❌ SPSN failed:`, error);
  }

  console.log('\n✅ Oracle tests completed');
}

testOracles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

