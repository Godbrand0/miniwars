'use client';

import { useState } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useGameContract } from '@/hooks/useGameContract';
import { useActiveGame } from '@/hooks/useActiveGame';
import { PlayerProfile } from '@/components/player-profile';
import Link from 'next/link';
import { createPublicClient, http, decodeEventLog } from 'viem';
import { celoSepolia } from 'viem/chains';
import MiniChessEscrowPaymasterABI from '@/contracts/MiniChessEscrowPaymaster.json';

// Dynamic imports with no SSR
const ChessBoard = dynamic(() => import('@/components/ChessBoard'), {
  ssr: false,
  loading: () => <div>Loading chess board...</div>
});

const PracticeBoard = dynamic(() => import('@/components/PracticeBoard'), {
  ssr: false,
  loading: () => <div>Loading practice board...</div>
});


export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const router = useRouter();
  const { createGameWithSession, joinGameWithSession, cancelGame, isReady, isSessionValid } = useGameContract();
  const { isChecking, setActiveGame } = useActiveGame();

  const [gameId, setGameId] = useState<number | null>(null);
  const [joinGameId, setJoinGameId] = useState('');
  const [cancelGameId, setCancelGameId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [showPracticeMode, setShowPracticeMode] = useState(false);

  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport: http()
  });

  const handleCreateGame = async () => {
    setIsLoading(true);
    try {
      const txHash = await createGameWithSession(address);
      console.log('Game creation tx:', txHash);
      
      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      
      // Find GameCreated event
      const gameCreatedLog = receipt.logs.find(log => {
        try {
          const event = decodeEventLog({
            abi: MiniChessEscrowPaymasterABI.abi,
            data: log.data,
            topics: log.topics
          });
          return event.eventName === 'GameCreated';
        } catch {
          return false;
        }
      });

      if (gameCreatedLog) {
        const event = decodeEventLog({
          abi: MiniChessEscrowPaymasterABI.abi,
          data: gameCreatedLog.data,
          topics: gameCreatedLog.topics
        });
        
        // @ts-ignore
        const newGameId = Number(event.args.gameId);
        console.log('Game created with ID:', newGameId);

        // Store active game ID
        setActiveGame(newGameId);

        // Redirect to game waiting room
        router.push(`/game/${newGameId}`);
      } else {
        console.error('GameCreated event not found in logs');
        alert('Game created but could not retrieve ID. Check console.');
      }
    } catch (error) {
      console.error('Failed to create game:', error);
      alert('Failed to create game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!joinGameId) return;
    
    setIsLoading(true);
    try {
      const txHash = await joinGameWithSession(parseInt(joinGameId), address);
      console.log('Game join tx:', txHash);
      
      // Wait for transaction receipt
      await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

      // Store active game ID
      setActiveGame(parseInt(joinGameId));

      // Redirect to game page
      router.push(`/game/${joinGameId}`);
      
    } catch (error) {
      console.error('Failed to join game:', error);
      alert('Failed to join game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelGame = async () => {
    if (!cancelGameId) return;
    
    setIsLoading(true);
    try {
      const txHash = await cancelGame(parseInt(cancelGameId));
      console.log('Cancel tx:', txHash);
      
      // Wait for transaction receipt
      await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      
      alert('Game cancelled successfully! Your funds have been refunded.');
      setCancelGameId('');
      
    } catch (error) {
      console.error('Failed to cancel game:', error);
      alert('Failed to cancel game. Make sure 5 minutes have passed since creation.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking for active game
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking for active games...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">MiniChess ♟️</h1>
          <p className="mb-4">Please connect your wallet to start playing</p>
        </div>
      </div>
    );
  }

  if (gameId && player1 && player2) {
    return (
      <div className="min-h-screen p-4">
        <div className="mb-4 text-center">
          <div className="inline-flex rounded-lg bg-green-100 p-1 text-sm">
            <span className="font-semibold text-green-800">
              🔄 Gasless Mode
            </span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center mb-6">MiniChess - Game #{gameId}</h1>
        <ChessBoard gameId={gameId} player1={player1} player2={player2} />
      </div>
    );
  }

  if (showPracticeMode) {
    return (
      <div className="min-h-screen p-4">
        <div className="mb-4 text-center">
          <button
            onClick={() => setShowPracticeMode(false)}
            className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded"
          >
            ← Back to Main Menu
          </button>
        </div>
        <h1 className="text-3xl font-bold text-center mb-6">Practice Mode</h1>
        <PracticeBoard />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">MiniChess ♟️</h1>
          <p className="text-gray-600">Gasless chess on Celo with session keys</p>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">✨ Single Signature Gameplay</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>🔑 One signature for session + game creation</p>
            <p>💸 Zero gas fees during gameplay</p>
            <p>🚫 No popups after initial setup</p>
            <p>⏱️ 2-hour session validity</p>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Create New Game</h2>
            <p className="text-sm text-gray-600 mb-4">
              Deposit 2.5 cUSD to start a game
            </p>
            <button
              onClick={handleCreateGame}
              disabled={isLoading || !isReady}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Game'}
            </button>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Join Existing Game</h2>
            <input
              type="text"
              placeholder="Enter Game ID"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value)}
              className="w-full border rounded-lg p-3 mb-4"
            />
            <button
              onClick={handleJoinGame}
              disabled={isLoading || !joinGameId || !isReady}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Joining...' : 'Join Game'}
            </button>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-2">🔧 Cancel Stuck Game (Temporary)</h2>
            <p className="text-xs text-gray-500 mb-4">
              For games created before routing was added. Remove this later.
            </p>
            <input
              type="text"
              placeholder="Enter Game ID to Cancel"
              value={cancelGameId}
              onChange={(e) => setCancelGameId(e.target.value)}
              className="w-full border rounded-lg p-3 mb-4"
            />
            <button
              onClick={handleCancelGame}
              disabled={isLoading || !cancelGameId}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? 'Cancelling...' : 'Cancel Game & Get Refund'}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              ⚠️ Only works after 5 minutes have passed since game creation
            </p>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Practice Mode</h2>
          <p className="text-sm text-gray-600 mb-4">
            Play against the computer to improve your chess skills
          </p>
          <button
            onClick={() => setShowPracticeMode(true)}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700"
          >
            Practice vs Computer
          </button>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">🏆 Leaderboard</h2>
            <Link href="/leaderboard">
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                View Full Leaderboard →
              </button>
            </Link>
          </div>
          <div className="text-center py-4">
            <p className="text-gray-600 mb-4">Top players competing in MiniChess</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="text-2xl mb-1">🥇</div>
                <div className="text-sm font-semibold">84% Win Rate</div>
                <div className="text-xs text-gray-600">42W / 8L</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl mb-1">🥈</div>
                <div className="text-sm font-semibold">80% Win Rate</div>
                <div className="text-xs text-gray-600">28W / 7L</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg">
                <div className="text-2xl mb-1">🥉</div>
                <div className="text-sm font-semibold">75% Win Rate</div>
                <div className="text-xs text-gray-600">45W / 15L</div>
              </div>
            </div>
          </div>
        </div>

        <PlayerProfile />

        <div className="bg-gray-50 rounded-lg p-4 text-sm">
          <h3 className="font-semibold mb-2">How it works:</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Each piece has a value (Pawn: $0.05 → Queen: $0.50)</li>
            <li>When you capture, you earn the piece's value instantly</li>
            <li>Starting escrow: $2.50 cUSD per player</li>
            <li>Winner keeps their remaining balance</li>
            <li className="font-semibold text-green-600">
              ✨ Gasless Mode: Zero gas fees + no popups!
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
