const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configuration
const config = {
  RPC_URL: process.env.RPC_URL || 'https://rpc.ankr.com/celo_sepolia',
  ENTRYPOINT_ADDRESS: process.env.ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  PAYMASTER_ADDRESS: process.env.PAYMASTER_ADDRESS || '',
  BENEFICIARY_ADDRESS: process.env.BENEFICIARY_ADDRESS || '',
  PRIVATE_KEY: process.env.PRIVATE_KEY || ''
};

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(config.RPC_URL);
const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);

// EntryPoint ABI (minimal)
const entryPointABI = [
  "function getUserOpHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, uint256 gasFees, bytes paymasterAndData, bytes signature)) view returns (bytes32)",
  "function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, uint256 gasFees, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external",
  "function simulateValidation((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, uint256 gasFees, bytes paymasterAndData, bytes signature) userOp) external returns (uint256 validationData, uint256 validUntil, uint256 validAfter, address paymaster)",
  "function balanceOf(address account) view returns (uint256)"
];

// Paymaster ABI (minimal)
const paymasterABI = [
  "function getHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, uint256 gasFees, bytes paymasterAndData, bytes signature), bytes32 context, uint256 maxCost) view returns (bytes32)",
  "function validatePaymasterUserOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, uint256 gasFees, bytes paymasterAndData, bytes signature), bytes32 userOpHash, uint256 maxCost) external returns (bytes memory context, uint256 validationData)"
];

const entryPointContract = new ethers.Contract(config.ENTRYPOINT_ADDRESS, entryPointABI, provider);
const paymasterContract = new ethers.Contract(config.PAYMASTER_ADDRESS, paymasterABI, provider);

// Helper function to validate user operation
async function validateUserOp(userOp) {
  try {
    // Basic validation
    if (!userOp.sender || !userOp.nonce || !userOp.callData) {
      throw new Error('Missing required user operation fields');
    }

    // Get user operation hash
    const userOpHash = await entryPointContract.getUserOpHash(userOp);
    
    // Simulate validation
    const [validationData] = await entryPointContract.simulateValidation(userOp);
    
    return { valid: true, userOpHash, validationData };
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, error: error.message };
  }
}

// Helper function to get paymaster data
async function getPaymasterData(userOp) {
  try {
    // Call paymaster to get sponsorship data
    const paymasterWithSigner = paymasterContract.connect(wallet);
    
    // This is a simplified implementation
    // In a real implementation, you would need to properly construct the paymasterAndData
    const paymasterAndData = ethers.solidityPacked(
      ['address', 'uint256'],
      [config.PAYMASTER_ADDRESS, ethers.parseEther('0.01')] // 0.01 CELO max cost
    );
    
    return paymasterAndData;
  } catch (error) {
    console.error('Paymaster error:', error);
    throw error;
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get paymaster data for user operation
app.post('/pm_getPaymasterData', async (req, res) => {
  try {
    const { userOperation } = req.body;
    
    if (!userOperation) {
      return res.status(400).json({ error: 'Missing userOperation' });
    }
    
    // Validate user operation
    const validation = await validateUserOp(userOperation);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Get paymaster data
    const paymasterAndData = await getPaymasterData(userOperation);
    
    res.json({
      paymasterAndData,
      userOpHash: validation.userOpHash
    });
  } catch (error) {
    console.error('Error in pm_getPaymasterData:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send user operation
app.post('/sendUserOperation', async (req, res) => {
  try {
    const { userOperation } = req.body;
    
    if (!userOperation) {
      return res.status(400).json({ error: 'Missing userOperation' });
    }
    
    console.log('Received user operation:', JSON.stringify(userOperation, null, 2));
    
    // Handle custom format with operations array
    if (userOperation.operations && Array.isArray(userOperation.operations)) {
      console.log('Processing custom format with operations array');
      
      const { sender, operations } = userOperation;
      
      if (!sender || operations.length === 0) {
        return res.status(400).json({ error: 'Missing sender or operations' });
      }
      
      // For now, we'll execute each operation directly using the wallet
      // This is a simplified approach - in production you'd want to use account abstraction properly
      const results = [];
      
      for (const op of operations) {
        console.log('Executing operation:', op);
        
        const tx = await wallet.sendTransaction({
          to: op.target,
          data: op.data,
          value: op.value || '0',
          gasLimit: 3000000 // Explicit gas limit to bypass estimation for dependent txs
        });
        
        console.log('Transaction sent:', tx.hash);
        // Don't wait for confirmation to avoid timeouts
        // const receipt = await tx.wait();
        // console.log('Transaction confirmed:', receipt.hash);
        
        results.push({
          transactionHash: tx.hash,
          status: 'sent'
        });
      }
      
      // Return the last transaction hash as the main result
      return res.json({
        transactionHash: results[results.length - 1].transactionHash,
        allTransactions: results,
        status: 'success'
      });
    }
    
    // Handle standard ERC-4337 UserOperation format
    // Validate user operation
    const validation = await validateUserOp(userOperation);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Get paymaster data if not provided
    if (!userOperation.paymasterAndData || userOperation.paymasterAndData === '0x') {
      userOperation.paymasterAndData = await getPaymasterData(userOperation);
    }
    
    // Send user operation through EntryPoint
    const entryPointWithSigner = entryPointContract.connect(wallet);
    const tx = await entryPointWithSigner.handleOps([userOperation], config.BENEFICIARY_ADDRESS);
    
    // Wait for transaction
    const receipt = await tx.wait();
    
    res.json({
      transactionHash: receipt.hash,
      userOpHash: validation.userOpHash,
      status: 'success'
    });
  } catch (error) {
    console.error('Error in sendUserOperation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user operation status
app.get('/getUserOperationStatus/:userOpHash', async (req, res) => {
  try {
    const { userOpHash } = req.params;
    
    // This is a simplified implementation
    // In a real implementation, you would track user operations in a database
    res.json({
      userOpHash,
      status: 'pending',
      message: 'User operation is being processed'
    });
  } catch (error) {
    console.error('Error in getUserOperationStatus:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get paymaster balance
app.get('/getPaymasterBalance', async (req, res) => {
  try {
    const balance = await provider.getBalance(config.PAYMASTER_ADDRESS);
    const deposit = await entryPointContract.balanceOf(config.PAYMASTER_ADDRESS);
    
    res.json({
      address: config.PAYMASTER_ADDRESS,
      balance: ethers.formatEther(balance),
      deposit: ethers.formatEther(deposit)
    });
  } catch (error) {
    console.error('Error in getPaymasterBalance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get gas prices
app.get('/getGasPrices', async (req, res) => {
  try {
    const feeData = await provider.getFeeData();
    
    res.json({
      maxFeePerGas: feeData.maxFeePerGas?.toString() || "10000000000", // 10 gwei fallback
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || "1000000000" // 1 gwei fallback
    });
  } catch (error) {
    console.error('Error in getGasPrices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`MiniChess Bundler running on port ${PORT}`);
  console.log(`Configuration:`);
  console.log(`- RPC URL: ${config.RPC_URL}`);
  console.log(`- EntryPoint: ${config.ENTRYPOINT_ADDRESS}`);
  console.log(`- Paymaster: ${config.PAYMASTER_ADDRESS}`);
  console.log(`- Beneficiary: ${config.BENEFICIARY_ADDRESS}`);
});

module.exports = app;