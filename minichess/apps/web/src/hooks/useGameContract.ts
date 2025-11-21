import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { createGameSessionSimple } from '../lib/smart-account';
import { parseEther } from 'viem';
import MiniChessEscrowPaymasterABI from '../contracts/MiniChessEscrowPaymaster.json';

export function useGameContract() {
  const { address } = useAccount();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  // Create game with session authorization in single transaction
  async function createGameWithSession(wallet: any) {
    setLoading(true);
    try {
      const client = await createGameSessionSimple(wallet.address);
      setClient(client);
      setSessionActive(true);
      
      // Store session info for auto-signing
      localStorage.setItem('gameSession', JSON.stringify({
        validUntil: Date.now() + 7200000, // 2 hours
        targets: [process.env.NEXT_PUBLIC_CONTRACT_ADDRESS],
        selectors: ['0xf7683440'], // capturePiecePaymaster selector
        valueLimit: '2.5'
      }));
      
      // Create game with session signature
      const sessionMessageHash = require('viem').keccak256(
        require('viem').toUtf8Bytes(`AUTHORIZE_SESSION${Date.now()}`)
      );
      const sessionSignature = await wallet.signMessage(sessionMessageHash);
      
      const tx = await client.writeContract({
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: MiniChessEscrowPaymasterABI.abi,
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
      const client = await createGameSessionSimple(wallet.address);
      setClient(client);
      setSessionActive(true);
      
      // Store session info for auto-signing
      localStorage.setItem('gameSession', JSON.stringify({
        validUntil: Date.now() + 7200000, // 2 hours
        targets: [process.env.NEXT_PUBLIC_CONTRACT_ADDRESS],
        selectors: ['0xf7683440'], // capturePiecePaymaster selector
        valueLimit: '2.5'
      }));
      
      // Join game with session signature
      const sessionMessageHash = require('viem').keccak256(
        require('viem').toUtf8Bytes(`AUTHORIZE_SESSION${gameId}_${Date.now()}`)
      );
      const sessionSignature = await wallet.signMessage(sessionMessageHash);
      
      const tx = await client.writeContract({
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: MiniChessEscrowPaymasterABI.abi,
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
      const client = await createGameSessionSimple(wallet.address);
      setClient(client);
      setSessionActive(true);
      
      // Store session info for auto-signing
      localStorage.setItem('gameSession', JSON.stringify({
        validUntil: Date.now() + 7200000, // 2 hours
        targets: [process.env.NEXT_PUBLIC_CONTRACT_ADDRESS],
        selectors: ['0xf7683440'], // capturePiecePaymaster selector
        valueLimit: '2.5'
      }));
      
    } catch (error) {
      console.error('Failed to create game session:', error);
    } finally {
      setLoading(false);
    }
  }

  // Gasless capture transaction (no user signature needed)
  async function capturePiecePaymaster(gameId: number, captor: string, pieceType: number) {
    if (!client) throw new Error('Client not initialized');
    if (!sessionActive) throw new Error('Session not active');

    // Create signature for capture
    const captureMessageHash = require('viem').keccak256(
      require('viem').toUtf8Bytes(`CAPTURE_PIECE${gameId}${captor}${pieceType}`)
    );
    const sessionData = JSON.parse(localStorage.getItem('gameSession') || '{}');
    const sessionSignature = await window.ethereum.request({
      method: 'personal_sign',
      params: [captureMessageHash, sessionData.address || captor]
    });

    const tx = await client.writeContract({
      address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      abi: MiniChessEscrowPaymasterABI.abi,
      functionName: 'capturePiecePaymaster',
      args: [BigInt(gameId), captor as `0x${string}`, pieceType, sessionSignature]
    });

    return tx;
  }

  // Get player statistics
  async function getPlayerStats(playerAddress: string) {
    if (!client) throw new Error('Client not initialized');

    const stats = await client.readContract({
      address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      abi: MiniChessEscrowPaymasterABI.abi,
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
      abi: MiniChessEscrowPaymasterABI.abi,
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
      abi: MiniChessEscrowPaymasterABI.abi,
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