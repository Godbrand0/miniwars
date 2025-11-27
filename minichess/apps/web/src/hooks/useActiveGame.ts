'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { createPublicClient, http } from 'viem';
import { celoSepolia } from 'viem/chains';
import MiniChessEscrowPaymasterABI from '@/contracts/MiniChessEscrowPaymaster.json';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const ACTIVE_GAME_KEY = 'minichess_active_game';

export function useActiveGame() {
  const { address } = useAccount();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport: http()
  });

  // Save active game ID to localStorage
  const setActiveGame = (gameId: number) => {
    if (typeof window !== 'undefined' && address) {
      const key = `${ACTIVE_GAME_KEY}_${address.toLowerCase()}`;
      localStorage.setItem(key, gameId.toString());
    }
  };

  // Get active game ID from localStorage
  const getActiveGame = (): number | null => {
    if (typeof window !== 'undefined' && address) {
      const key = `${ACTIVE_GAME_KEY}_${address.toLowerCase()}`;
      const gameId = localStorage.getItem(key);
      return gameId ? parseInt(gameId) : null;
    }
    return null;
  };

  // Clear active game from localStorage
  const clearActiveGame = () => {
    if (typeof window !== 'undefined' && address) {
      const key = `${ACTIVE_GAME_KEY}_${address.toLowerCase()}`;
      localStorage.removeItem(key);
    }
  };

  // Check if a game is still active on the blockchain
  const checkGameStatus = async (gameId: number): Promise<boolean> => {
    try {
      const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: MiniChessEscrowPaymasterABI.abi,
        functionName: 'getGame',
        args: [BigInt(gameId)]
      }) as [string, string, bigint, bigint, number, string, bigint, bigint];

      const [player1, player2, , , status] = result;

      // Check if game is active or waiting AND the current user is a player
      const isPlayer =
        address?.toLowerCase() === player1.toLowerCase() ||
        address?.toLowerCase() === player2.toLowerCase();

      // Status: 0 = WAITING, 1 = ACTIVE, 2 = FINISHED, 3 = CANCELLED
      const isActiveOrWaiting = status === 0 || status === 1;

      return isPlayer && isActiveOrWaiting;
    } catch (error) {
      console.error('Error checking game status:', error);
      return false;
    }
  };

  // Check for active game on mount and redirect if found
  useEffect(() => {
    const checkAndRedirect = async () => {
      if (!address) {
        setIsChecking(false);
        return;
      }

      const gameId = getActiveGame();
      if (!gameId) {
        setIsChecking(false);
        return;
      }

      console.log('Found stored game ID:', gameId);

      // Check if the game is still active
      const isActive = await checkGameStatus(gameId);

      if (isActive) {
        console.log('Game is still active, redirecting to game page');
        router.push(`/game/${gameId}`);
      } else {
        console.log('Game is no longer active, clearing from storage');
        clearActiveGame();
        setIsChecking(false);
      }
    };

    checkAndRedirect();
  }, [address]);

  return {
    isChecking,
    setActiveGame,
    getActiveGame,
    clearActiveGame,
    checkGameStatus
  };
}
