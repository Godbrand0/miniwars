# MiniChess Custom Bundler

This is a custom bundler implementation for the MiniChess paymaster on Celo Sepolia.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy the environment file and update it:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
- `PAYMASTER_ADDRESS`: Your deployed paymaster contract address
- `BENEFICIARY_ADDRESS`: Address to receive gas fees
- `PRIVATE_KEY`: Private key for the bundler account (with CELO for gas)

## Running the Bundler

Start the bundler server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

The bundler will start on port 3000 by default.

## API Endpoints

### Health Check
```
GET /health
```

### Get Paymaster Data
```
POST /pm_getPaymasterData
Content-Type: application/json

{
  "userOperation": {
    "sender": "0x...",
    "nonce": "0x...",
    "initCode": "0x...",
    "callData": "0x...",
    "accountGasLimits": "0x...",
    "preVerificationGas": "0x...",
    "gasFees": "0x...",
    "paymasterAndData": "0x...",
    "signature": "0x..."
  }
}
```

### Send User Operation
```
POST /sendUserOperation
Content-Type: application/json

{
  "userOperation": {
    // Same format as above
  }
}
```

### Get User Operation Status
```
GET /getUserOperationStatus/:userOpHash
```

### Get Paymaster Balance
```
GET /getPaymasterBalance
```

## Integration with Frontend

Update your frontend to use this bundler instead of third-party services:

```javascript
const BUNDLER_URL = 'http://localhost:3000';

// Get paymaster data
const response = await fetch(`${BUNDLER_URL}/pm_getPaymasterData`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userOperation })
});

// Send user operation
const tx = await fetch(`${BUNDLER_URL}/sendUserOperation`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userOperation })
});
```

## Security Considerations

1. Keep your private key secure
2. Use HTTPS in production
3. Implement rate limiting
4. Monitor for unusual activity
5. Regularly check paymaster balance

## Monitoring

Check the paymaster balance:
```bash
curl http://localhost:3000/getPaymasterBalance
```

## Troubleshooting

1. **Invalid user operation**: Check that all required fields are present
2. **Insufficient paymaster balance**: Fund the paymaster contract
3. **RPC errors**: Verify the RPC URL is correct
4. **Private key issues**: Ensure the private key has sufficient CELO for gas