# Paymaster Implementation Guide 🎮💰

Complete guide for integrating Pimlico paymaster into MiniChess for gasless gameplay on Celo.

---

## 📋 Prerequisites

- Node.js 18+
- MiniPay wallet or compatible AA wallet
- Pimlico API key (free tier)
- Celo Alfajores testnet CELO (for testing)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install permissionless viem @account-abstraction/contracts
```

### 2. Get Pimlico API Key

1. Visit https://dashboard.pimlico.io
2. Sign up (free)
3. Create new project
4. Copy API key

### 3. Environment Setup

```bash
# .env.local
NEXT_PUBLIC_PIMLICO_API_KEY=pim_xxxxxxxxxx
NEXT_PUBLIC_CHAIN_ENV=testnet # or mainnet
```

---

## 🏗️ Implementation

### Configuration File

```javascript
// lib/paymaster-config.js
import { createPimlicoBundlerClient } from 'permissionless/clients/pimlico'
import { http } from 'viem'
import { celo, celoAlfajores } from 'viem/chains'

const CHAIN = process.env.NEXT_PUBLIC_CHAIN_ENV === 'mainnet' 
  ? celo 
  : celoAlfajores

const PIMLICO_RPC = process.env.NEXT_PUBLIC_CHAIN_ENV === 'mainnet'
  ? 'https://api.pimlico.io/v2/celo/rpc'
  : 'https://api.pimlico.io/v2/celo-alfajores/rpc'

const ENTRYPOINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'

export const paymasterClient = createPimlicoBundlerClient({
  chain: CHAIN,
  transport: http(
    `${PIMLICO_RPC}?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`
  ),
  entryPoint: ENTRYPOINT
})

export { CHAIN, ENTRYPOINT }
```

### Smart Account Setup

```javascript
// lib/smart-account.js
import { createSmartAccountClient } from 'permissionless'
import { signerToSafeSmartAccount } from 'permissionless/accounts'
import { paymasterClient, CHAIN, ENTRYPOINT } from './paymaster-config'

export async function createGameAccount(signer) {
  // Create Safe smart account
  const account = await signerToSafeSmartAccount({
    signer,
    entryPoint: ENTRYPOINT,
    safeVersion: '1.4.1',
    safe4337ModuleAddress: '0xa581c4A4DB7175302464fF3C06380BC3270b4037',
    erc7579LaunchpadAddress: '0xEBe001b3D534B9B6E2500FB78E67a1A137f561CE'
  })

  // Create client with paymaster
  const smartAccountClient = createSmartAccountClient({
    account,
    chain: CHAIN,
    bundler: paymasterClient,
    paymaster: paymasterClient, // Pimlico handles both
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await paymasterClient.getUserOperationGasPrice()).fast
      }
    }
  })

  return smartAccountClient
}
```

### Game Integration

```javascript
// hooks/useGameContract.js
import { useState, useEffect } from 'react'
import { createGameAccount } from '@/lib/smart-account'
import { parseEther } from 'viem'

export function useGameContract() {
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(false)

  // Initialize on wallet connection
  async function initialize(wallet) {
    setLoading(true)
    try {
      const smartClient = await createGameAccount(wallet)
      setClient(smartClient)
    } catch (error) {
      console.error('Failed to create smart account:', error)
    } finally {
      setLoading(false)
    }
  }

  // Gasless capture transaction
  async function capturePiece(pieceType, pieceValue) {
    if (!client) throw new Error('Client not initialized')

    const tx = await client.writeContract({
      address: GAME_CONTRACT_ADDRESS,
      abi: GAME_ABI,
      functionName: 'capturePiece',
      args: [pieceType, parseEther(pieceValue)]
    })

    return tx
  }

  return { initialize, capturePiece, loading }
}
```

### React Component Example

```javascript
// components/ChessBoard.jsx
import { useGameContract } from '@/hooks/useGameContract'

export function ChessBoard() {
  const { capturePiece, loading } = useGameContract()

  async function handleCapture(piece) {
    try {
      const pieceValues = {
        pawn: '0.05',
        knight: '0.15',
        bishop: '0.15',
        rook: '0.25',
        queen: '0.50'
      }

      // This happens without any wallet popup!
      const hash = await capturePiece(piece.type, pieceValues[piece.type])
      
      console.log('Capture tx:', hash)
      // Update UI optimistically
    } catch (error) {
      console.error('Capture failed:', error)
    }
  }

  return (
    <div>
      {/* Your chess board UI */}
      {loading && <p>Processing capture...</p>}
    </div>
  )
}
```

---

## 💰 Funding Guide

### Testnet (Free)
No funding required. Pimlico sponsors all testnet transactions.

### Mainnet

#### Step 1: Add Credits
1. Go to https://dashboard.pimlico.io/billing
2. Click "Add Credits"
3. Add $20-50 via credit card

#### Step 2: Monitor Usage
```javascript
// utils/monitor-balance.js
export async function checkPaymasterBalance() {
  const response = await fetch('https://api.pimlico.io/v1/balance', {
    headers: {
      'x-api-key': process.env.PIMLICO_API_KEY
    }
  })
  
  const data = await response.json()
  
  if (data.balance < 10) {
    // Send alert to admin
    console.warn('Low paymaster balance:', data.balance)
  }
  
  return data.balance
}
```

#### Step 3: Set Spending Limits (Dashboard)
- Max $1 per user per day
- Rate limit: 50 tx/hour
- Only allow your game contract address

---

## 📊 Cost Analysis

### Per Transaction
- Celo mainnet: ~$0.01
- Capture transaction: ~$0.008-0.012

### Per Game (30 captures avg)
- Gas cost: $0.12
- Pimlico fee: Included
- **Total: $0.12/game**

### Monthly Estimate
- 100 games: $12
- 500 games: $60
- 1000 games: $120

**Tip**: Charge $0.25 entry fee to cover gas + profit

---

## 🔐 Security Best Practices

### 1. Rate Limiting
```javascript
// Implement on your backend
const rateLimit = new Map()

function checkRateLimit(address) {
  const now = Date.now()
  const userLimits = rateLimit.get(address) || { count: 0, reset: now }
  
  if (now > userLimits.reset) {
    rateLimit.set(address, { count: 1, reset: now + 3600000 })
    return true
  }
  
  if (userLimits.count >= 50) return false
  
  userLimits.count++
  return true
}
```

### 2. Contract Validation
Only sponsor transactions to your game contract:

```javascript
// In Pimlico dashboard > Policies
{
  "allowedTargets": ["0xYourGameContractAddress"],
  "allowedMethods": ["0x12345678"], // capturePiece selector
  "spendingLimit": "1000000000000000000" // 1 cUSD per tx max
}
```

### 3. User Verification
```javascript
// Verify user owns the smart account
async function verifyOwner(smartAccount, expectedOwner) {
  const owners = await smartAccount.read.getOwners()
  return owners.includes(expectedOwner)
}
```

---

## 🐛 Troubleshooting

### Error: "AA21 didn't pay prefund"
**Solution**: Your paymaster balance is empty. Add credits on mainnet.

### Error: "execution reverted"
**Solution**: Check contract address and ABI are correct.

### Transactions Taking Too Long
**Solution**: Increase `maxFeePerGas` or use `fast` gas price:
```javascript
const gasPrice = await paymasterClient.getUserOperationGasPrice()
// Use gasPrice.fast instead of gasPrice.standard
```

### API Key Invalid
**Solution**: Ensure API key has no extra spaces and is in `.env.local`

---

## 📈 Monitoring & Analytics

### Track Usage
```javascript
// Log every sponsored transaction
async function logTransaction(userOp, hash) {
  await db.transactions.create({
    user: userOp.sender,
    hash,
    gasUsed: userOp.actualGasUsed,
    cost: calculateCost(userOp),
    timestamp: Date.now()
  })
}
```

### Weekly Report
```javascript
// Generate cost summary
async function generateWeeklyReport() {
  const txs = await db.transactions.find({
    timestamp: { $gte: Date.now() - 604800000 }
  })
  
  const totalCost = txs.reduce((sum, tx) => sum + tx.cost, 0)
  const avgPerGame = totalCost / (txs.length / 30)
  
  return { totalCost, avgPerGame, txCount: txs.length }
}
```

---

## 🚢 Production Checklist

- [ ] API key added to production environment
- [ ] Paymaster funded with $50+ credits
- [ ] Spending limits configured in dashboard
- [ ] Rate limiting implemented
- [ ] Contract addresses whitelisted
- [ ] Monitoring/alerts set up
- [ ] Low balance notifications enabled
- [ ] Error handling tested
- [ ] Gas price strategy configured
- [ ] User verification implemented

---

## 📚 Resources

- [Pimlico Docs](https://docs.pimlico.io)
- [Permissionless.js](https://docs.pimlico.io/permissionless)
- [Celo Account Abstraction](https://docs.celo.org/protocol/transaction/erc-4337)
- [ERC-4337 Standard](https://eips.ethereum.org/EIPS/eip-4337)

---

## 🆘 Support

- Pimlico Discord: https://discord.gg/pimlico
- Celo Discord: https://discord.gg/celo
- GitHub Issues: [Your repo]

---

## 📝 License

MIT