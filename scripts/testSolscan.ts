import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.SOLSCAN_API_KEY || '';

async function testSolscan() {
  console.log('Testing Solscan API...');
  console.log('API Key length:', API_KEY.length);
  console.log('API Key start:', API_KEY.substring(0, 20) + '...');
  
  try {
    // Try multiple header formats
    const formats = [
      { name: 'token (no prefix)', headers: { 'token': API_KEY } },
      { name: 'Authorization Bearer', headers: { 'Authorization': `Bearer ${API_KEY}` } },
      { name: 'X-API-KEY', headers: { 'X-API-KEY': API_KEY } },
      { name: 'api-key', headers: { 'api-key': API_KEY } },
    ];
    
    for (const format of formats) {
      console.log(`\n--- Testing with ${format.name} ---`);
      const response = await fetch(
        'https://pro-api.solscan.io/v2.0/token/meta?address=Sg4k4iFaEeqhv5866cQmsFTMhRx8sVCPAq2j8Xcpump',
        { headers: format.headers }
      );
      
      console.log('Status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ SUCCESS! This format works!');
        console.log('Market Cap:', data.data?.marketCapFD);
        console.log('Price:', data.data?.priceUsdt);
        break;
      } else {
        const text = await response.text();
        console.log('Response:', text.substring(0, 200));
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testSolscan();

