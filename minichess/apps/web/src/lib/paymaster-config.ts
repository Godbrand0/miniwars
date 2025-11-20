import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { http } from 'viem'
import { celo, celoAlfajores } from 'viem/chains'

const CHAIN = process.env.NEXT_PUBLIC_CHAIN_ENV === 'mainnet' 
  ? celo 
  : celoAlfajores

const PIMLICO_RPC = process.env.NEXT_PUBLIC_CHAIN_ENV === 'mainnet'
  ? 'https://api.pimlico.io/v2/celo/rpc'
  : 'https://api.pimlico.io/v2/celo-alfajores/rpc'

const ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'

export const paymasterClient = createPimlicoClient({
  chain: CHAIN,
  transport: http(
    `${PIMLICO_RPC}?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`
  ),
  entryPoint: {
    address: ENTRYPOINT_ADDRESS,
    version: "0.7"
  } as any
})

export { CHAIN, ENTRYPOINT_ADDRESS as ENTRYPOINT }