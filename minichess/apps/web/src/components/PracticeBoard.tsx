'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { usePracticeGame } from '@/hooks/usePracticeGame';
import PracticeStats from '@/components/practice-stats';

// Dynamic import with no SSR
const Chessboard = dynamic(() => import('react-chessboard').then(mod => mod.Chessboard), {
  ssr: false,
  loading: () => <div>Loading chessboard...</div> // Optional loading state
}) as any;

export default function PracticeBoard() {
  const { game, isThinking, gameStats, startNewGame, makePlayerMove } = usePracticeGame();
  const [showStats, setShowStats] = useState(false);

  const handlePieceDrop = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    if (!targetSquare) return false;
    return makePlayerMove(sourceSquare, targetSquare);
  };

  const formatTime = (startTime: number) => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getGameStatus = () => {
    if (game.isCheckmate()) {
      return game.turn() === 'w' ? 'AI Wins!' : 'You Win!';
    }
    if (game.isDraw()) {
      return 'Draw!';
    }
    return isThinking ? 'AI is thinking...' : 'Your turn!';
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Practice Mode</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
            >
              {showStats ? 'Hide Stats' : 'Show Stats'}
            </button>
            <button
              onClick={startNewGame}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              New Game
            </button>
          </div>
        </div>
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Practice Mode</h2>
          <button 
            onClick={startNewGame}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
          >
            New Game
          </button>
        </div>

        <div className="mb-4 bg-gray-100 p-3 rounded-lg">
          <div className="flex justify-between text-sm">
            <span>Moves: {gameStats.moves}</span>
            <span>Captures: {gameStats.captures}</span>
            <span>Time: {formatTime(gameStats.startTime)}</span>
          </div>
        </div>

        <Chessboard
          position={game.fen()}
          onPieceDrop={handlePieceDrop}
          boardOrientation='white'
        />

        <div className="mt-4 text-center text-sm">
          <span className={`font-bold ${
            game.isCheckmate() || game.isDraw() 
              ? 'text-red-600' 
              : isThinking 
                ? 'text-blue-600' 
                : 'text-green-600'
          }`}>
            {getGameStatus()}
          </span>
        </div>

        {game.isGameOver() && (
          <div className="mt-4 text-center">
            <button 
              onClick={startNewGame}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {showStats && (
        <div className="w-full max-w-md">
          <PracticeStats />
        </div>
      )}
    </div>
  );
}