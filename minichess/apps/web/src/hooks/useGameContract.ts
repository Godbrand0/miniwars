import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { parseEther, createPublicClient, http, erc20Abi, encodeFunctionData } from 'viem';
import { celoSepolia } from 'viem/chains';
import MiniChessEscrowPaymasterABI from '../contracts/MiniChessEscrowPaymaster.json';

const CUSD_ADDRESS = '0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b'; // Celo Sepolia cUSD

export function useGameContract() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  // Note: The following functions have been disabled because Alchemy SDK was removed
  // They need to be refactored to work with the custom bundler implementation
  
  /**
   * Create game with session authorization using custom bundler
   */
  async function createGameWithSession(walletAddressOrWallet: any) {
    const userAddress = typeof walletAddressOrWallet === 'string'
      ? walletAddressOrWallet
      : walletAddressOrWallet?.address;
      
    console.log('[Game Contract] Creating game with session for address:', userAddress);
    
    if (!userAddress) {
      console.error('[Game Contract] No valid address provided');
      throw new Error('No valid address provided');
    }
    
    setLoading(true);
    try {
      // Initialize session
      await initializeGameSession(userAddress);
      
      // Get current game counter from contract
      const publicClient = createPublicClient({
        chain: celoSepolia,
        transport: http()
      });
      
      const gameCounter = await publicClient.readContract({
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: MiniChessEscrowPaymasterABI.abi,
        functionName: 'gameCounter'
      });
      
      const nextGameId = Number(gameCounter) + 1;
      const chainId = celoSepolia.id;
      
      console.log('[Game Contract] Next game ID:', nextGameId, 'Chain ID:', chainId);
      
      // Create session message matching contract format
      const { encodePacked, keccak256, createWalletClient, custom } = require('viem');
      const packedMessage = encodePacked(
        ['string', 'uint256', 'uint256'],
        ['AUTHORIZE_SESSION', BigInt(nextGameId), BigInt(chainId)]
      );
      
      const messageHash = keccak256(packedMessage);
      console.log('[Game Contract] Message hash:', messageHash);
      
      // Sign the hash
      const walletClient = createWalletClient({
        account: userAddress,
        chain: celoSepolia,
        transport: custom(window.ethereum)
      });
      
      const sessionSignature = await walletClient.signMessage({
        account: userAddress,
        message: { raw: messageHash }
      });
      
      console.log('[Game Contract] Session signature created');
      
      // Check cUSD allowance
      const allowance = await publicClient.readContract({
        address: CUSD_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [userAddress, process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`]
      });

      const escrowAmount = parseEther('2.5');
      const userOps: any[] = [];

      // Add approval if needed
      if (allowance < escrowAmount) {
        console.log('[Game Contract] Adding cUSD approval transaction');
        userOps.push({
          target: CUSD_ADDRESS as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`, escrowAmount]
          }),
          value: BigInt(0)
        });
      }

      // Add create game call
      userOps.push({
        target: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: MiniChessEscrowPaymasterABI.abi,
          functionName: 'createGameWithSession',
          args: [sessionSignature, userAddress]
        }),
        value: BigInt(0)
      });

      console.log('[Game Contract] Sending', userOps.length, 'user operations to bundler');
      
      // Convert BigInt values to strings for JSON serialization
      const serializableOps = userOps.map(op => ({
        target: op.target,
        data: op.data,
        value: op.value.toString()
      }));
      
      // Send to custom bundler
      const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || 'http://localhost:3001';
      const response = await fetch(`${bundlerUrl}/sendUserOperation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userOperation: {
            sender: userAddress,
            operations: serializableOps
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bundler error: ${error}`);
      }
      
      const data = await response.json();
      console.log('[Game Contract] Transaction hash:', data.transactionHash);

      return data.transactionHash;
      
    } catch (error) {
      console.error('[Game Contract] Failed to create game:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Join game with session authorization using custom bundler
   */
  async function joinGameWithSession(gameId: number, walletAddressOrWallet: any) {
    const userAddress = typeof walletAddressOrWallet === 'string'
      ? walletAddressOrWallet
      : walletAddressOrWallet?.address;
      
    console.log('[Game Contract] Joining game', gameId, 'for address:', userAddress);
    
    if (!userAddress) {
      console.error('[Game Contract] No valid address provided');
      throw new Error('No valid address provided');
    }
    
    setLoading(true);
    try {
      // Initialize session
      await initializeGameSession(userAddress);
      
      const chainId = celoSepolia.id;
      console.log('[Game Contract] Game ID:', gameId, 'Chain ID:', chainId);
      
      // Create session message matching contract format
      const { encodePacked, keccak256, createWalletClient, custom } = require('viem');
      const packedMessage = encodePacked(
        ['string', 'uint256', 'uint256'],
        ['AUTHORIZE_SESSION', BigInt(gameId), BigInt(chainId)]
      );
      
      const messageHash = keccak256(packedMessage);
      console.log('[Game Contract] Message hash:', messageHash);
      
      // Sign the hash
      const walletClient = createWalletClient({
        account: userAddress,
        chain: celoSepolia,
        transport: custom(window.ethereum)
      });
      
      const sessionSignature = await walletClient.signMessage({
        account: userAddress,
        message: { raw: messageHash }
      });
      
      console.log('[Game Contract] Session signature created');
      
      // Check cUSD allowance
      const publicClient = createPublicClient({
        chain: celoSepolia,
        transport: http()
      });

      const allowance = await publicClient.readContract({
        address: CUSD_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [userAddress, process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`]
      });

      const escrowAmount = parseEther('2.5');
      const userOps: any[] = [];

      // Add approval if needed
      if (allowance < escrowAmount) {
        console.log('[Game Contract] Adding cUSD approval transaction');
        userOps.push({
          target: CUSD_ADDRESS as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`, escrowAmount]
          }),
          value: BigInt(0)
        });
      }

      // Add join game call
      userOps.push({
        target: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: MiniChessEscrowPaymasterABI.abi,
          functionName: 'joinGameWithSession',
          args: [BigInt(gameId), sessionSignature, userAddress]
        }),
        value: BigInt(0)
      });

      console.log('[Game Contract] Sending', userOps.length, 'user operations to bundler');

      // Convert BigInt values to strings for JSON serialization
      const serializableOps = userOps.map(op => ({
        target: op.target,
        data: op.data,
        value: op.value.toString()
      }));

      // Send to custom bundler
      const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || 'http://localhost:3001';
      const response = await fetch(`${bundlerUrl}/sendUserOperation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userOperation: {
            sender: userAddress,
            operations: serializableOps
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bundler error: ${error}`);
      }
      
      const data = await response.json();
      console.log('[Game Contract] Transaction hash:', data.transactionHash);

      return data.transactionHash;
      
    } catch (error) {
      console.error('[Game Contract] Failed to join game:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Initialize game session
   * TODO: Refactor to use custom bundler instead of Alchemy SDK
   */
  async function initializeGameSession(walletAddressOrWallet: any) {
    console.log('🔍 DEBUG: initializeGameSession called with:', walletAddressOrWallet);
    
    const userAddress = typeof walletAddressOrWallet === 'string'
      ? walletAddressOrWallet
      : walletAddressOrWallet?.address;
      
    console.log('🔍 DEBUG: Extracted address:', userAddress);
    console.log('🔍 DEBUG: Contract address from env:', process.env.NEXT_PUBLIC_CONTRACT_ADDRESS);
    console.log('[Game Contract] Initializing game session for address:', userAddress);
    
    if (!userAddress) {
      console.error('[Game Contract] No valid address provided');
      return;
    }
    
    setLoading(true);
    try {
      // Store session info
      localStorage.setItem('gameSession', JSON.stringify({
        validUntil: Date.now() + 7200000, // 2 hours
        targets: [process.env.NEXT_PUBLIC_CONTRACT_ADDRESS],
        selectors: ['0xf7683440'], // capturePiecePaymaster selector
        valueLimit: '2.5',
        address: userAddress
      }));
      
      setSessionActive(true);
      console.log('[Game Contract] Session initialized successfully');
      
    } catch (error) {
      console.error('[Game Contract] Failed to initialize session:', error);
      console.log('🔍 DEBUG: Error message:', error instanceof Error ? error.message : String(error));
      console.log('🔍 DEBUG: Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    } finally {
      setLoading(false);
    }
  }

  // Fallback function for backward compatibility
  async function createGameSessionSimple(walletAddressOrWallet: any) {
    console.log('🔍 DEBUG: createGameSessionSimple called - redirecting to initializeGameSession');
    return initializeGameSession(walletAddressOrWallet);
  }

  /**
   * Gasless capture transaction using custom bundler
   */
  async function capturePiecePaymaster(gameId: number, captor: string, pieceType: number) {
    console.log('[Game Contract] Capturing piece - Game:', gameId, 'Captor:', captor, 'Type:', pieceType);
    
    if (!sessionActive) {
      console.error('[Game Contract] Session not active');
      throw new Error('Session not active');
    }

    try {
      // Create signature for capture matching contract format
      const { encodePacked, keccak256, createWalletClient, custom } = require('viem');
      const chainId = celoSepolia.id;
      
      const packedMessage = encodePacked(
        ['string', 'uint256', 'address', 'uint256', 'uint256'],
        ['CAPTURE_PIECE', BigInt(gameId), captor as `0x${string}`, BigInt(pieceType), BigInt(chainId)]
      );
      
      const messageHash = keccak256(packedMessage);
      console.log('[Game Contract] Capture message hash:', messageHash);
      
      const sessionData = JSON.parse(localStorage.getItem('gameSession') || '{}');
      const signerAddress = sessionData.address || captor;
      
      // Sign the hash
      const walletClient = createWalletClient({
        account: signerAddress,
        chain: celoSepolia,
        transport: custom(window.ethereum)
      });
      
      const sessionSignature = await walletClient.signMessage({
        account: signerAddress,
        message: { raw: messageHash }
      });

      console.log('[Game Contract] Capture signature created');

      // Prepare user operation
      const userOp = {
        target: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: MiniChessEscrowPaymasterABI.abi,
          functionName: 'capturePiecePaymaster',
          args: [
            BigInt(gameId),
            captor as `0x${string}`,
            pieceType,
            sessionSignature,
            signerAddress
          ]
        }),
        value: BigInt(0)
      };

      console.log('[Game Contract] Sending capture operation to bundler');

      // Convert BigInt values to strings for JSON serialization
      const serializableOp = {
        target: userOp.target,
        data: userOp.data,
        value: userOp.value.toString()
      };

      // Send to custom bundler
      const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || 'http://localhost:3001';
      const response = await fetch(`${bundlerUrl}/sendUserOperation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userOperation: {
            sender: signerAddress,
            operations: [serializableOp]
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bundler error: ${error}`);
      }
      
      const data = await response.json();
      console.log('[Game Contract] Capture transaction hash:', data.transactionHash);

      return data.transactionHash;
      
    } catch (error) {
      console.error('[Game Contract] Failed to capture piece:', error);
      throw error;
    }
  }

  /**
   * Get player statistics
   */
  async function getPlayerStats(playerAddress: string) {
    console.log('[Game Contract] Fetching stats for player:', playerAddress);
    
    try {
      const publicClient = createPublicClient({
        chain: celoSepolia,
        transport: http()
      });

      const stats = await publicClient.readContract({
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: MiniChessEscrowPaymasterABI.abi,
        functionName: 'getPlayerStats',
        args: [playerAddress as `0x${string}`]
      });

      console.log('[Game Contract] Player stats retrieved:', stats);
      return stats;
    } catch (error) {
      console.error('[Game Contract] Failed to get player stats:', error);
      throw error;
    }
  }

  /**
   * Get player game history
   */
  async function getPlayerGameHistory(playerAddress: string, limit: number = 10, offset: number = 0) {
    console.log('[Game Contract] Fetching game history for player:', playerAddress, 'Limit:', limit, 'Offset:', offset);
    
    try {
      const publicClient = createPublicClient({
        chain: celoSepolia,
        transport: http()
      });

      const gameHistory = await publicClient.readContract({
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: MiniChessEscrowPaymasterABI.abi,
        functionName: 'getPlayerGameHistory',
        args: [playerAddress as `0x${string}`, BigInt(limit), BigInt(offset)]
      });

      console.log('[Game Contract] Game history retrieved:', gameHistory);
      return gameHistory;
    } catch (error) {
      console.error('[Game Contract] Failed to get game history:', error);
      throw error;
    }
  }

  /**
   * Get player game count
   */
  async function getPlayerGameCount(playerAddress: string) {
    console.log('[Game Contract] Fetching game count for player:', playerAddress);
    
    try {
      const publicClient = createPublicClient({
        chain: celoSepolia,
        transport: http()
      });

      const count = await publicClient.readContract({
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: MiniChessEscrowPaymasterABI.abi,
        functionName: 'getPlayerGameCount',
        args: [playerAddress as `0x${string}`]
      });

      console.log('[Game Contract] Game count retrieved:', count);
      return count;
    } catch (error) {
      console.error('[Game Contract] Failed to get game count:', error);
      throw error;
    }
  }

  /**
   * Check if session is still valid
   */
  function isSessionValid(): boolean {
    const sessionData = localStorage.getItem('gameSession');
    if (!sessionData) {
      console.log('[Game Contract] No session data found');
      return false;
    }
    
    const session = JSON.parse(sessionData);
    const isValid = Date.now() < session.validUntil;
    console.log('[Game Contract] Session validity check:', isValid);
    return isValid;
  }

  /**
   * Cancel a waiting game and get refund
   */
  async function cancelGame(gameId: number) {
    console.log('[Game Contract] Cancelling game:', gameId);

    if (!address) {
      throw new Error('No wallet connected');
    }

    setLoading(true);
    try {
      const { encodeFunctionData, createWalletClient, custom } = require('viem');

      // Prepare cancel game transaction
      const userOp = {
        target: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: MiniChessEscrowPaymasterABI.abi,
          functionName: 'cancelGame',
          args: [BigInt(gameId)]
        }),
        value: BigInt(0)
      };

      console.log('[Game Contract] Sending cancel operation to bundler');

      // Convert BigInt values to strings for JSON serialization
      const serializableOp = {
        target: userOp.target,
        data: userOp.data,
        value: userOp.value.toString()
      };

      // Send to custom bundler
      const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || 'http://localhost:3001';
      const response = await fetch(`${bundlerUrl}/sendUserOperation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userOperation: {
            sender: address,
            operations: [serializableOp]
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bundler error: ${error}`);
      }

      const data = await response.json();
      console.log('[Game Contract] Cancel transaction hash:', data.transactionHash);

      return data.transactionHash;

    } catch (error) {
      console.error('[Game Contract] Failed to cancel game:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Claim timeout win when opponent hasn't moved
   */
  async function claimTimeout(gameId: number) {
    console.log('[Game Contract] Claiming timeout for game:', gameId);

    if (!address) {
      throw new Error('No wallet connected');
    }

    setLoading(true);
    try {
      const { encodeFunctionData } = require('viem');

      // Prepare claim timeout transaction
      const userOp = {
        target: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: MiniChessEscrowPaymasterABI.abi,
          functionName: 'claimTimeout',
          args: [BigInt(gameId)]
        }),
        value: BigInt(0)
      };

      console.log('[Game Contract] Sending timeout claim operation to bundler');

      // Convert BigInt values to strings for JSON serialization
      const serializableOp = {
        target: userOp.target,
        data: userOp.data,
        value: userOp.value.toString()
      };

      // Send to custom bundler
      const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || 'http://localhost:3001';
      const response = await fetch(`${bundlerUrl}/sendUserOperation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userOperation: {
            sender: address,
            operations: [serializableOp]
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bundler error: ${error}`);
      }

      const data = await response.json();
      console.log('[Game Contract] Timeout claim transaction hash:', data.transactionHash);

      return data.transactionHash;

    } catch (error) {
      console.error('[Game Contract] Failed to claim timeout:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  // Auto-initialize when wallet connects
  useEffect(() => {
    console.log('[Game Contract] Wallet connection detected:', address);
    
    if (address && typeof window !== 'undefined' && window.ethereum) {
      if (isSessionValid()) {
        console.log('[Game Contract] Reusing existing valid session');
        setSessionActive(true);
      } else {
        console.log('[Game Contract] Creating new session');
        initializeGameSession(address);
      }
    }
  }, [address]);

  return {
    createGameWithSession,
    joinGameWithSession,
    initializeGameSession,
    createGameSessionSimple, // Add fallback for backward compatibility
    capturePiecePaymaster,
    cancelGame,
    claimTimeout,
    getPlayerStats,
    getPlayerGameHistory,
    getPlayerGameCount,
    loading,
    isReady: sessionActive,
    isSessionValid
  };
}
