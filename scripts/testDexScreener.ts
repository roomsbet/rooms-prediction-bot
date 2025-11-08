async function testDexScreener() {
  const tokenAddress = 'Sg4k4iFaEeqhv5866cQmsFTMhRx8sVCPAq2j8Xcpump';
  
  console.log('Testing DexScreener API...');
  console.log('Token:', tokenAddress);
  
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS!\n');
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        console.log('Symbol:', pair.baseToken?.symbol);
        console.log('Name:', pair.baseToken?.name);
        console.log('Price USD:', pair.priceUsd);
        console.log('Market Cap USD:', pair.marketCap);
        console.log('DEX:', pair.dexId);
        console.log('Pair Address:', pair.pairAddress);
        
        console.log('\n--- Checking targets ---');
        const marketCap = parseFloat(pair.marketCap || '0');
        console.log(`Market Cap: $${(marketCap / 1_000_000).toFixed(2)}M`);
        console.log(`Target 1.7M: ${marketCap >= 1_700_000 ? 'YES ✅' : 'NO ❌'}`);
        console.log(`Target 2M: ${marketCap >= 2_000_000 ? 'YES ✅' : 'NO ❌'}`);
      } else {
        console.log('No pairs found for this token');
      }
    } else {
      const text = await response.text();
      console.log('❌ Failed');
      console.log('Response:', text.substring(0, 500));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testDexScreener();



