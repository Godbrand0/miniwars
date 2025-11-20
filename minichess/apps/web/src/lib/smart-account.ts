import { createSmartAccountClient } from 'permissionless'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { paymasterClient, CHAIN, ENTRYPOINT } from './paymaster-config'
import { parseEther } from 'viem'

export async function createGameAccount(signer: any) {
  // Create Safe smart account
  const safeAccount = await toSafeSmartAccount({
    signer,
    entryPoint: ENTRYPOINT,
    safeVersion: '1.4.1',
    safe4337ModuleAddress: '0xa581c4A4DB7175302464fF3C06380BC3270b4037',
    erc7579LaunchpadAddress: '0xEBe001b3D534B9B6E2500FB78E67a1A137f561CE'
  })

  // Create client with paymaster
  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain: CHAIN,
    paymaster: paymasterClient, // Pimlico handles both
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await paymasterClient.getUserOperationGasPrice()).fast
      }
    }
  })

  return smartAccountClient
}

export async function setupGameSession(userWallet: any) {
  // Create Safe smart account first
  const safeAccount = await toSafeSmartAccount({
    signer: userWallet,
    entryPoint: ENTRYPOINT,
    safeVersion: '1.4.1',
    safe4337ModuleAddress: '0xa581c4A4DB7175302464fF3C06380BC3270b4037',
    erc7579LaunchpadAddress: '0xEBe001b3D534B9B6E2500FB78E67a1A137f561CE'
  })

  // Create session key permissions (user signs once)
  const sessionPermissions = {
    validUntil: Date.now() + 7200000, // 2 hours
    targets: [process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`],
    selectors: ['0x12345678'], // capturePiece method selector
    valueLimit: parseEther('6.50') // Max game value
  }

  // Create client with session + paymaster
  const client = createSmartAccountClient({
    account: safeAccount,
    chain: CHAIN,
    paymaster: paymasterClient, // Gasless
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await paymasterClient.getUserOperationGasPrice()).fast
      }
    }
  })

  return { client, sessionPermissions }
}