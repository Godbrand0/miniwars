const { ethers } = require('ethers');

// Configuration
const BUNDLER_URL = process.env.BUNDLER_URL || 'http://localhost:3000';
const PAYMASTER_ADDRESS = process.env.PAYMASTER_ADDRESS || '0x70ce509337494fbbcbc337cc1d71294d000ae82a';
const PRIVATE_KEY = process.env.PRIVATE_KEY || 'ad03c579052d5093c83d34224efb31a2d6ad3bc917d3c5c25a527a1ac7cc6904';
const GAME_CONTRACT_ADDRESS = process.env.GAME_CONTRACT_ADDRESS || '0x2D44905Ca27E1d45fFCe14E69effa8A06BAb6996';

// Test user operation (simplified)
const testUserOp = {
  sender: '0x742d35Cc6634C0532925a3b8D4E7E0E0e3e4d8c',
  nonce: '0x0',
  initCode: '0x',
  callData: '0x',
  accountGasLimits: '0x',
  preVerificationGas: '0x',
  gasFees: '0x',
  paymasterAndData: '0x',
  signature: '0x'
};

async function testPaymaster() {
  console.log('🧪 Testing Custom Paymaster Implementation');
  console.log('=====================================');
  
  try {
    // Test 1: Check bundler health
    console.log('\n1️⃣ Testing bundler health...');
    const healthResponse = await fetch(`${BUNDLER_URL}/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Bundler is healthy:', health);
    } else {
      console.log('❌ Bundler health check failed');
      return;
    }
    
    // Test 2: Get paymaster balance
    console.log('\n2️⃣ Testing paymaster balance...');
    const balanceResponse = await fetch(`${BUNDLER_URL}/getPaymasterBalance`);
    if (balanceResponse.ok) {
      const balance = await balanceResponse.json();
      console.log('✅ Paymaster balance:', balance);
    } else {
      console.log('❌ Failed to get paymaster balance');
    }
    
    // Test 3: Get gas prices
    console.log('\n3️⃣ Testing gas prices...');
    const gasResponse = await fetch(`${BUNDLER_URL}/getGasPrices`);
    if (gasResponse.ok) {
      const gasPrices = await gasResponse.json();
      console.log('✅ Gas prices:', gasPrices);
    } else {
      console.log('❌ Failed to get gas prices');
    }
    
    // Test 4: Get paymaster data
    console.log('\n4️⃣ Testing paymaster data generation...');
    const paymasterResponse = await fetch(`${BUNDLER_URL}/pm_getPaymasterData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userOperation: testUserOp
      })
    });
    
    if (paymasterResponse.ok) {
      const paymasterData = await paymasterResponse.json();
      console.log('✅ Paymaster data generated:', paymasterData);
    } else {
      const error = await paymasterResponse.text();
      console.log('❌ Failed to get paymaster data:', error);
    }
    
    // Test 5: Check contract on-chain
    if (PAYMASTER_ADDRESS && PRIVATE_KEY) {
      console.log('\n5️⃣ Testing contract interaction...');
      
      const provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/celo_sepolia');
      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
      
      try {
        const code = await provider.getCode(PAYMASTER_ADDRESS);
        if (code !== '0x') {
          console.log('✅ Paymaster contract is deployed at:', PAYMASTER_ADDRESS);
          
          // Test contract configuration
          const contract = new ethers.Contract(PAYMASTER_ADDRESS, [
            "function getConfiguration() view returns (address, uint256, uint256, uint256)"
          ], provider);
          
          try {
            const config = await contract.getConfiguration();
            console.log('✅ Contract configuration:', {
              allowedTarget: config[0],
              maxCostPerOperation: ethers.formatEther(config[1]),
              balance: ethers.formatEther(config[2]),
              deposit: ethers.formatEther(config[3])
            });
          } catch (error) {
            console.log('⚠️  Could not read contract configuration:', error.message);
          }
        } else {
          console.log('❌ No contract found at:', PAYMASTER_ADDRESS);
        }
      } catch (error) {
        console.log('❌ Contract interaction failed:', error.message);
      }
    } else {
      console.log('\n⚠️  Skipping contract test (missing PAYMASTER_ADDRESS or PRIVATE_KEY)');
    }
    
    console.log('\n🎉 Paymaster testing complete!');
    console.log('=============================');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testPaymaster();