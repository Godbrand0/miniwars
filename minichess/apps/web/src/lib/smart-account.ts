import { createSmartAccountClient } from 'permissionless'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { paymasterClient, CHAIN } from './paymaster-config'
import { parseEther, encodeFunctionData, type Address, http, createPublicClient } from 'viem'
import { celoAlfajores } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const GAME_CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Address
const ESCROW_AMOUNT = parseEther('2.5')

// Create a proper public client for the toSafeSmartAccount function
const publicClient = createPublicClient({
  chain: celoAlfajores,
  transport: http()
})

/**
 * Create basic smart account (no session)
 */
export async function createGameAccount(owner: Address) {
  // Convert address to account format
  const ownerAccount = {
    address: owner,
    type: 'json-rpc' as const
  }
  
  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [ownerAccount],
    entryPoint: {
      address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      version: "0.7"
    },
    version: "1.4.1"
  })

  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain: CHAIN,
    bundlerTransport: http(
      `https://api.pimlico.io/v2/celo-alfajores/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`
    ),
    paymaster: paymasterClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await paymasterClient.getUserOperationGasPrice()).fast
      }
    }
  })

  return smartAccountClient
}

/**
 * Simplified session setup (recommended for your use case)
 */
export async function createGameSessionSimple(owner: Address) {
  // Convert address to account format
  const ownerAccount = {
    address: owner,
    type: 'json-rpc' as const
  }
  
  // Create Safe with session permissions in one call
  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [ownerAccount],
    entryPoint: {
      address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      version: "0.7"
    },
    version: "1.4.1"
  })

  // Create client - this will request ONE signature for session
  const client = createSmartAccountClient({
    account: safeAccount,
    chain: CHAIN,
    bundlerTransport: http(
      `https://api.pimlico.io/v2/celo-alfajores/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`
    ),
    paymaster: paymasterClient
  })

  return client
}