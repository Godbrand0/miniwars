import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { setupGameSession } from '../lib/smart-account';
import { parseEther } from 'viem';

export function useGameContract() {
  const { address } = useAccount();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  // Create game with session authorization in single transaction
  async function createGameWithSession(wallet: any) {
    setLoading(true);
    try {
      const { client, sessionPermissions } = await setupGameSession(wallet);
      setClient(client);
      setSessionActive(true);
      
      // Store session info for auto-signing
      localStorage.setItem('gameSession', JSON.stringify({
        validUntil: sessionPermissions.validUntil,
        targets: sessionPermissions.targets,
        selectors: sessionPermissions.selectors,
        valueLimit: sessionPermissions.valueLimit
      }));
      
      // Create game with session signature
      const sessionMessage = `AUTHORIZE_SESSION_${Date.now()}`;
      const sessionSignature = await wallet.signMessage(sessionMessage);
      
      const tx = await client.writeContract({
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: [
          {
            "inputs": [
              {"name": "sessionSignature", "type": "bytes"}
            ],
            "name": "createGameWithSession",
            "outputs": [
              {"name": "", "type": "uint256"}
            ],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ],
        functionName: 'createGameWithSession',
        args: [sessionSignature]
      });

      return tx;
      
    } catch (error) {
      console.error('Failed to create game with session:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  // Join game with session authorization in single transaction
  async function joinGameWithSession(gameId: number, wallet: any) {
    setLoading(true);
    try {
      const { client, sessionPermissions } = await setupGameSession(wallet);
      setClient(client);
      setSessionActive(true);
      
      // Store session info for auto-signing
      localStorage.setItem('gameSession', JSON.stringify({
        validUntil: sessionPermissions.validUntil,
        targets: sessionPermissions.targets,
        selectors: sessionPermissions.selectors,
        valueLimit: sessionPermissions.valueLimit
      }));
      
      // Join game with session signature
      const sessionMessage = `AUTHORIZE_SESSION_${gameId}_${Date.now()}`;
      const sessionSignature = await wallet.signMessage(sessionMessage);
      
      const tx = await client.writeContract({
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: [
          {
            "inputs": [
              {"name": "gameId", "type": "uint256"},
              {"name": "sessionSignature", "type": "bytes"}
            ],
            "name": "joinGameWithSession",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ],
        functionName: 'joinGameWithSession',
        args: [BigInt(gameId), sessionSignature]
      });

      return tx;
      
    } catch (error) {
      console.error('Failed to join game with session:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  // Initialize game session with paymaster + session keys (legacy)
  async function initializeGameSession(wallet: any) {
    setLoading(true);
    try {
      const { client, sessionPermissions } = await setupGameSession(wallet);
      setClient(client);
      setSessionActive(true);
      
      // Store session info for auto-signing
      localStorage.setItem('gameSession', JSON.stringify({
        validUntil: sessionPermissions.validUntil,
        targets: sessionPermissions.targets,
        selectors: sessionPermissions.selectors,
        valueLimit: sessionPermissions.valueLimit
      }));
      
    } catch (error) {
      console.error('Failed to create game session:', error);
    } finally {
      setLoading(false);
    }
  }

  // Gasless capture transaction (no user signature needed)
  async function capturePiecePaymaster(gameId: number, pieceType: number) {
    if (!client) throw new Error('Client not initialized');
    if (!sessionActive) throw new Error('Session not active');

    const tx = await client.writeContract({
      address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      abi: [
        {
          "inputs": [
            {"name": "gameId", "type": "uint256"},
            {"name": "pieceType", "type": "uint8"}
          ],
          "name": "capturePiecePaymaster",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ],
      functionName: 'capturePiecePaymaster',
      args: [BigInt(gameId), pieceType]
      // No signature needed - session key auto-signs!
    });

    return tx;
  }

  // Get player statistics
  async function getPlayerStats(playerAddress: string) {
    if (!client) throw new Error('Client not initialized');

    const stats = await client.readContract({
      address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      abi: [
        {
          "inputs": [
            {"name": "player", "type": "address"}
          ],
          "name": "getPlayerStats",
          "outputs": [
            {"name": "gamesPlayed", "type": "uint256"},
            {"name": "gamesWon", "type": "uint256"},
            {"name": "gamesLost", "type": "uint256"},
            {"name": "totalEarned", "type": "uint256"},
            {"name": "totalLost", "type": "uint256"},
            {"name": "winRate", "type": "uint256"}
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      functionName: 'getPlayerStats',
      args: [playerAddress as `0x${string}`]
    });

    return stats;
  }

  // Get player game history
  async function getPlayerGameHistory(playerAddress: string, limit: number = 10, offset: number = 0) {
    if (!client) throw new Error('Client not initialized');

    const gameHistory = await client.readContract({
      address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      abi: [
        {
          "inputs": [
            {"name": "player", "type": "address"},
            {"name": "limit", "type": "uint256"},
            {"name": "offset", "type": "uint256"}
          ],
          "name": "getPlayerGameHistory",
          "outputs": [
            {"name": "", "type": "uint256[]"}
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      functionName: 'getPlayerGameHistory',
      args: [playerAddress as `0x${string}`, BigInt(limit), BigInt(offset)]
    });

    return gameHistory;
  }

  // Get player game count
  async function getPlayerGameCount(playerAddress: string) {
    if (!client) throw new Error('Client not initialized');

    const count = await client.readContract({
      address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      abi: [
        {
          "inputs": [
            {"name": "player", "type": "address"}
          ],
          "name": "getPlayerGameCount",
          "outputs": [
            {"name": "", "type": "uint256"}
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      functionName: 'getPlayerGameCount',
      args: [playerAddress as `0x${string}`]
    });

    return count;
  }

  // Check if session is still valid
  function isSessionValid(): boolean {
    const sessionData = localStorage.getItem('gameSession');
    if (!sessionData) return false;
    
    const session = JSON.parse(sessionData);
    return Date.now() < session.validUntil;
  }

  // Auto-initialize when wallet connects
  useEffect(() => {
    if (address && typeof window !== 'undefined' && window.ethereum) {
      if (isSessionValid()) {
        // Reuse existing session
        setSessionActive(true);
      } else {
        // Create new session
        initializeGameSession(window.ethereum);
      }
    }
  }, [address]);

  return {
    createGameWithSession,
    joinGameWithSession,
    initializeGameSession,
    capturePiecePaymaster,
    getPlayerStats,
    getPlayerGameHistory,
    getPlayerGameCount,
    loading,
    isReady: !!client && sessionActive,
    isSessionValid
  };
}