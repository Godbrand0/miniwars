# Custom Paymaster Deployment Guide

This guide will walk you through deploying your own paymaster and bundler for MiniChess on Celo Sepolia.

## Prerequisites

- Node.js 18+
- Foundry installed
- CELO tokens for testnet (get from [Celo faucet](https://celo.org/developers/faucet))
- A wallet with private key for deployment

## Step 1: Deploy the Paymaster Contract

1. Navigate to the contracts directory:
```bash
cd minichess/apps/contracts
```

2. Set up environment variables:
```bash
export PRIVATE_KEY=your_private_key
export GAME_CONTRACT_ADDRESS=0xYourGameContractAddress
```

3. Deploy the paymaster contract:
```bash
forge script script/DeployCustomPaymaster.s.sol --rpc-url https://rpc.ankr.com/celo_sepolia --broadcast --verify
```

4. Save the deployed paymaster address from the output.

## Step 2: Set Up the Bundler

1. Navigate to the bundler directory:
```bash
cd minichess/bundler
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```bash
# RPC Configuration
RPC_URL=https://rpc.ankr.com/celo_sepolia

# Account Abstraction
ENTRYPOINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789

# Paymaster Configuration (replace with your values)
PAYMASTER_ADDRESS=0xYourDeployedPaymasterAddress
BENEFICIARY_ADDRESS=0xYourBeneficiaryAddress

# Bundler Private Key (with CELO for gas)
PRIVATE_KEY=your_private_key

# Server Configuration
PORT=3000
```

5. Start the bundler:
```bash
npm start
```

The bundler will start on port 3000. You can test it with:
```bash
curl http://localhost:3000/health
```

## Step 3: Fund the Paymaster

1. Fund the paymaster contract with CELO:
```bash
cast send 0xYourPaymasterAddress --value 0.1ether --private-key your_private_key --rpc-url https://rpc.ankr.com/celo_sepolia
```

2. Add deposit to EntryPoint:
```bash
cast send 0xYourPaymasterAddress "addEntryPointDeposit(uint256)" "0.1ether" --private-key your_private_key --rpc-url https://rpc.ankr.com/celo_sepolia
```

## Step 4: Configure Frontend

1. Navigate to the web app directory:
```bash
cd minichess/apps/web
```

2. Create environment file:
```bash
touch .env.local
```

3. Add configuration to `.env.local`:
```bash
# Custom Paymaster Configuration
NEXT_PUBLIC_PAYMASTER_ADDRESS=0xYourPaymasterAddress
NEXT_PUBLIC_BUNDLER_URL=http://localhost:3000

# Contract Configuration
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourGameContractAddress
NEXT_PUBLIC_CHAIN_ENV=testnet
```

4. Install required dependencies:
```bash
npm install permissionless viem @account-abstraction/contracts
```

## Step 5: Test the Implementation

1. Start the web app:
```bash
npm run dev
```

2. Connect your wallet and try creating a game or making a move.

3. Check the bundler logs for transaction processing.

## Monitoring

### Check Paymaster Balance
```bash
curl http://localhost:3000/getPaymasterBalance
```

### Check Bundler Health
```bash
curl http://localhost:3000/health
```

### Monitor Transactions
The bundler logs will show incoming requests and transaction processing.

## Troubleshooting

### Paymaster Issues

1. **"Invalid target" error**:
   - Check that `GAME_CONTRACT_ADDRESS` is correct
   - Verify the paymaster is configured with the right target

2. **"Insufficient paymaster balance"**:
   - Fund the paymaster contract with more CELO
   - Add more deposit to EntryPoint

3. **"Rate limit exceeded"**:
   - Wait for the rate limit window to reset (1 hour)
   - Adjust rate limits in the contract if needed

### Bundler Issues

1. **"Bundler not responding"**:
   - Check if the bundler is running on port 3000
   - Verify the `.env` configuration

2. **"RPC errors"**:
   - Check the RPC URL in bundler `.env`
   - Try a different RPC endpoint

3. **"Private key issues"**:
   - Ensure the private key has CELO for gas
   - Check the private key format

### Frontend Issues

1. **"Paymaster not available"**:
   - Check if bundler is running
   - Verify `NEXT_PUBLIC_BUNDLER_URL` is correct

2. **"Client not initialized"**:
   - Ensure wallet is connected
   - Check browser console for errors

## Security Considerations

1. **Private Keys**:
   - Never commit private keys to version control
   - Use environment variables for sensitive data
   - Consider using a hardware wallet for production

2. **Paymaster Security**:
   - Set reasonable gas limits
   - Implement rate limiting
   - Monitor for unusual activity

3. **Bundler Security**:
   - Use HTTPS in production
   - Implement authentication if needed
   - Monitor API usage

## Production Deployment

For production deployment:

1. Deploy to Celo Mainnet instead of Sepolia
2. Use a secure hosting service for the bundler
3. Set up monitoring and alerting
4. Implement proper error handling and logging
5. Consider using a load balancer for high availability

## Next Steps

Once your custom paymaster is running:

1. Test all game functions thoroughly
2. Monitor gas usage and costs
3. Adjust rate limits and gas limits as needed
4. Set up automated funding for the paymaster
5. Implement analytics for usage tracking