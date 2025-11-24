# MiniChess Custom Paymaster Implementation

This directory contains a complete self-hosted paymaster implementation for MiniChess on Celo Sepolia, allowing you to sponsor gas fees for your users without relying on third-party services like Alchemy or Pimlico.

## 📁 File Structure

```
minichess/
├── apps/contracts/src/
│   └── MiniChessCustomPaymaster.sol    # Custom paymaster contract
├── apps/contracts/script/
│   └── DeployCustomPaymaster.s.sol     # Deployment script
├── bundler/
│   ├── index.js                      # Bundler server implementation
│   ├── package.json                   # Bundler dependencies
│   └── .env.example                  # Environment template
├── apps/web/src/
│   ├── lib/custom-paymaster.ts         # Frontend integration
│   └── hooks/useCustomPaymaster.ts    # React hook for paymaster
├── deploy-custom-paymaster.sh          # Automated deployment script
├── test-custom-paymaster.js           # Test script
└── CUSTOM_PAYMASTER_DEPLOYMENT.md     # Detailed deployment guide
```

## 🚀 Quick Start

### 1. Deploy the Paymaster

```bash
# Set environment variables
export PRIVATE_KEY=your_private_key
export GAME_CONTRACT_ADDRESS=0xYourGameContractAddress

# Run the deployment script
./deploy-custom-paymaster.sh
```

### 2. Configure the Bundler

```bash
cd minichess/bundler
cp .env.example .env
# Edit .env with your configuration
npm install
npm start
```

### 3. Update Frontend

```bash
cd minichess/apps/web
# Create .env.local with:
# NEXT_PUBLIC_PAYMASTER_ADDRESS=0xYourPaymasterAddress
# NEXT_PUBLIC_BUNDLER_URL=http://localhost:3000
npm run dev
```

## 🔧 Components

### Paymaster Contract (`MiniChessCustomPaymaster.sol`)

Features:
- ✅ Gas sponsorship for MiniChess operations
- ✅ Rate limiting (50 ops/hour per user)
- ✅ Maximum gas cost controls
- ✅ Owner-only configuration
- ✅ Deposit management
- ✅ Event logging for monitoring

Key Functions:
- `validatePaymasterUserOp()` - Validates and sponsors user operations
- `addEntryPointDeposit()` - Adds deposit to EntryPoint
- `withdrawEntryPointDeposit()` - Withdraws from EntryPoint
- `updateAllowedTarget()` - Changes the sponsored contract
- `updateMaxCost()` - Adjusts gas cost limits

### Bundler Service (`bundler/index.js`)

Features:
- ✅ RESTful API for paymaster operations
- ✅ User operation validation
- ✅ Gas price estimation
- ✅ Transaction submission
- ✅ Health monitoring

API Endpoints:
- `GET /health` - Health check
- `POST /pm_getPaymasterData` - Get paymaster data
- `POST /sendUserOperation` - Submit user operation
- `GET /getPaymasterBalance` - Check paymaster balance
- `GET /getGasPrices` - Get current gas prices

### Frontend Integration (`custom-paymaster.ts`)

Features:
- ✅ Smart account creation
- ✅ Paymaster data generation
- ✅ Gasless transaction submission
- ✅ Error handling
- ✅ Balance monitoring

## 📊 Monitoring

### Check Paymaster Balance
```bash
curl http://localhost:3000/getPaymasterBalance
```

### Test the Implementation
```bash
# Set environment variables
export BUNDLER_URL=http://localhost:3000
export PAYMASTER_ADDRESS=0xYourPaymasterAddress
export PRIVATE_KEY=your_private_key

# Run tests
node test-custom-paymaster.js
```

## 🔒 Security Considerations

### Paymaster Contract
1. **Access Control**: Only owner can configure settings
2. **Rate Limiting**: Prevents abuse (50 ops/hour)
3. **Gas Limits**: Maximum cost per operation (0.01 CELO)
4. **Target Validation**: Only sponsors MiniChess contract

### Bundler Service
1. **Private Key Security**: Never commit to version control
2. **Input Validation**: Validates all user operations
3. **Error Handling**: Proper error responses
4. **Rate Limiting**: Consider implementing API rate limits

### Frontend
1. **Environment Variables**: Never expose sensitive data
2. **Error Handling**: Graceful fallbacks
3. **User Feedback**: Clear status indicators

## 🛠️ Configuration

### Environment Variables

#### Paymaster Deployment
```bash
PRIVATE_KEY=your_private_key                    # Deployer wallet
GAME_CONTRACT_ADDRESS=0xYourGameContract   # MiniChess contract
```

#### Bundler Service
```bash
RPC_URL=https://rpc.ankr.com/celo_sepolia      # Celo RPC
ENTRYPOINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
PAYMASTER_ADDRESS=0xYourPaymasterAddress        # Deployed paymaster
BENEFICIARY_ADDRESS=0xYourBeneficiaryAddress   # Gas fee recipient
PRIVATE_KEY=your_private_key                    # Bundler wallet
PORT=3000                                   # Server port
```

#### Frontend
```bash
NEXT_PUBLIC_PAYMASTER_ADDRESS=0xYourPaymasterAddress
NEXT_PUBLIC_BUNDLER_URL=http://localhost:3000
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourGameContract
NEXT_PUBLIC_CHAIN_ENV=testnet
```

## 📈 Cost Analysis

### Paymaster Operation Costs
- **Per Transaction**: ~0.01 CELO maximum
- **Gas Limit**: Configurable (default 0.01 CELO)
- **Rate Limit**: 50 operations/hour per user

### Monthly Estimates
- **100 Games**: ~1.2 CELO
- **500 Games**: ~6.0 CELO
- **1000 Games**: ~12.0 CELO

## 🔄 Maintenance

### Regular Tasks
1. **Monitor Balance**: Check paymaster balance weekly
2. **Refill as Needed**: Add CELO when balance is low
3. **Review Usage**: Analyze transaction patterns
4. **Update Limits**: Adjust rate limits if needed

### Automation
```bash
# Add to crontab for weekly balance check
0 9 * * 1 /path/to/check-balance.sh
```

## 🚨 Troubleshooting

### Common Issues

1. **"Paymaster not available"**
   - Check if bundler is running
   - Verify BUNDLER_URL in frontend
   - Check network connectivity

2. **"Invalid target" error**
   - Verify GAME_CONTRACT_ADDRESS
   - Update paymaster configuration
   - Check contract deployment

3. **"Insufficient balance"**
   - Fund paymaster contract
   - Add EntryPoint deposit
   - Check withdrawal history

4. **"Rate limit exceeded"**
   - Wait for window reset (1 hour)
   - Check for abuse patterns
   - Adjust limits if needed

## 📚 Resources

- [ERC-4337 Standard](https://eips.ethereum.org/EIPS/eip-4337)
- [Celo Documentation](https://docs.celo.org/)
- [Account Abstraction Guide](https://docs.celo.org/protocol/transaction/erc-4337)
- [Foundry Documentation](https://book.getfoundry.sh/)

## 🆘 Support

For issues with this implementation:
1. Check the troubleshooting section
2. Review the deployment guide
3. Test with the provided test script
4. Check contract logs on Celo Explorer

## 📝 License

MIT License - Feel free to modify and distribute.