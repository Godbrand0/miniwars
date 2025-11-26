'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { celoSepolia } from 'viem/chains';
import ChessBoard from '@/components/ChessBoard';
import { useGameContract } from '@/hooks/useGameContract';
import MiniChessEscrowPaymasterABI from '@/contracts/MiniChessEscrowPaymaster.json';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { cancelGame, loading: cancelLoading } = useGameContract();
  const gameId = Number(params.gameId);

  const [gameState, setGameState] = useState<{
    player1: string;
    player2: string;
    status: number;
    player1Balance: bigint;
    player2Balance: bigint;
    createdAt: bigint;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [canCancel, setCanCancel] = useState(false);

  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport: http()
  });

  // Poll game state
  useEffect(() => {
    if (!gameId || isNaN(gameId)) {
      setError('Invalid game ID');
      setIsLoading(false);
      return;
    }

    const fetchGameState = async () => {
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: MiniChessEscrowPaymasterABI.abi,
          functionName: 'getGame',
          args: [BigInt(gameId)]
        }) as [string, string, bigint, bigint, number, string, bigint, bigint];

        const [player1, player2, player1Balance, player2Balance, status, winner, createdAt] = result;

        setGameState({
          player1,
          player2,
          status,
          player1Balance,
          player2Balance,
          createdAt
        });
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching game state:', err);
        setError('Failed to load game');
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchGameState();

    // Poll every 3 seconds
    const interval = setInterval(fetchGameState, 3000);

    return () => clearInterval(interval);
  }, [gameId]);

  // Track time elapsed since game creation
  useEffect(() => {
    if (!gameState || gameState.status !== 0) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const created = Number(gameState.createdAt);
      const elapsed = now - created;
      setTimeElapsed(elapsed);
      setCanCancel(elapsed >= 300); // 5 minutes = 300 seconds
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [gameState]);

  const handleCancelGame = async () => {
    if (!canCancel) {
      alert('You must wait 5 minutes before cancelling');
      return;
    }

    if (!confirm('Are you sure you want to cancel this game? You will receive a full refund.')) {
      return;
    }

    try {
      const txHash = await cancelGame(gameId);
      console.log('Cancel transaction:', txHash);
      
      // Wait a moment for the transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to home
      router.push('/');
    } catch (error) {
      console.error('Failed to cancel game:', error);
      alert('Failed to cancel game. Please try again.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">MiniChess ♟️</h1>
          <p className="mb-4">Please connect your wallet to view this game</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
          <p className="mb-4">{error || 'Game not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Game Status: 0 = WAITING, 1 = ACTIVE, 2 = FINISHED, 3 = CANCELLED
  const isWaiting = gameState.status === 0;
  const isActive = gameState.status === 1;
  const isFinished = gameState.status === 2;
  const isCancelled = gameState.status === 3;

  const isPlayer1 = address?.toLowerCase() === gameState.player1.toLowerCase();
  const isPlayer2 = address?.toLowerCase() === gameState.player2.toLowerCase();
  const isPlayer = isPlayer1 || isPlayer2;

  // Waiting Room
  if (isWaiting) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white shadow-lg rounded-lg p-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold mb-2">Game #{gameId}</h1>
              <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full">
                <div className="animate-pulse w-2 h-2 bg-yellow-600 rounded-full"></div>
                <span className="font-semibold">Waiting for Player 2...</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h2 className="font-semibold mb-3 text-gray-700">Game Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Player 1:</span>
                  <span className="font-mono text-xs">
                    {gameState.player1.slice(0, 6)}...{gameState.player1.slice(-4)}
                    {isPlayer1 && <span className="ml-2 text-green-600">(You)</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Player 2:</span>
                  <span className="text-gray-400">Waiting...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Escrow:</span>
                  <span className="font-semibold">2.5 cUSD each</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Share Game ID</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gameId.toString()}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg bg-white text-center font-bold text-lg"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(gameId.toString());
                    alert('Game ID copied to clipboard!');
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                Share this ID with your opponent so they can join
              </p>
            </div>

            {isPlayer1 && (
              <div className="text-center">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="text-sm text-gray-600 mb-2">
                    Time elapsed: <span className="font-mono font-semibold">{formatTime(timeElapsed)}</span>
                  </div>
                  {!canCancel && (
                    <div className="text-xs text-gray-500">
                      Can cancel in: {formatTime(300 - timeElapsed)}
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 mb-3">
                  Game will start automatically when Player 2 joins
                </p>
                
                {canCancel ? (
                  <button
                    onClick={handleCancelGame}
                    disabled={cancelLoading}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 mb-2"
                  >
                    {cancelLoading ? 'Cancelling...' : 'Cancel Game & Get Refund'}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/')}
                    className="text-gray-600 hover:text-gray-800 text-sm underline"
                  >
                    Go back (no refund)
                  </button>
                )}
              </div>
            )}

            {!isPlayer && (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">
                  You are spectating this game
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                  Back to Home
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active Game
  if (isActive) {
    return (
      <div className="min-h-screen p-4">
        <div className="mb-4 text-center">
          <div className="inline-flex rounded-lg bg-green-100 p-1 text-sm">
            <span className="font-semibold text-green-800">
              🔄 Gasless Mode Active
            </span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center mb-6">MiniChess - Game #{gameId}</h1>
        <ChessBoard 
          gameId={gameId} 
          player1={gameState.player1} 
          player2={gameState.player2} 
        />
      </div>
    );
  }

  // Finished or Cancelled
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">
          {isFinished ? 'Game Finished' : 'Game Cancelled'}
        </h1>
        <p className="mb-4 text-gray-600">
          {isFinished ? 'This game has ended' : 'This game was cancelled'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
