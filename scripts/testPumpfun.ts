async function testPumpfun() {
  const tokenAddress = 'Sg4k4iFaEeqhv5866cQmsFTMhRx8sVCPAq2j8Xcpump';
  
  console.log('Testing Pump.fun API...');
  console.log('Token:', tokenAddress);
  
  try {
    const response = await fetch(
      `https://frontend-api.pump.fun/coins/${tokenAddress}`
    );
    
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS!\n');
      console.log('Symbol:', data.symbol);
      console.log('Name:', data.name);
      console.log('Price USD:', data.price);
      console.log('USD Market Cap:', data.usd_market_cap);
      console.log('Market Cap (parsed):', parseFloat(data.usd_market_cap || '0'));
      console.log('\nFull response:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('❌ Failed');
      console.log('Response:', text);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testPumpfun();



