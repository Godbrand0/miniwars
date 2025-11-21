import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessAI } from '@/lib/chess-ai';
import { PracticeStatsManager } from '@/lib/practice-stats';

export function usePracticeGame() {
  const [game, setGame] = useState(new Chess());
  const [ai] = useState(() => new ChessAI());
  const [isThinking, setIsThinking] = useState(false);
  const [gameStats, setGameStats] = useState({
    moves: 0,
    captures: 0,
    startTime: Date.now()
  });

  // Check for game over and save stats
  useEffect(() => {
    if (game.isGameOver() && gameStats.moves > 0) {
      const gameTime = Math.floor((Date.now() - gameStats.startTime) / 1000);
      let result: 'win' | 'lose' | 'draw';
      
      if (game.isCheckmate()) {
        result = game.turn() === 'w' ? 'lose' : 'win';
      } else {
        result = 'draw';
      }
      
      PracticeStatsManager.saveGame({
        result,
        moves: gameStats.moves,
        captures: gameStats.captures,
        time: gameTime
      });
    }
  }, [game, gameStats]);

  const startNewGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setGameStats({
      moves: 0,
      captures: 0,
      startTime: Date.now()
    });
  }, []);

  const makePlayerMove = useCallback((from: string, to: string) => {
    if (isThinking) return false;

    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({ from, to, promotion: 'q' });
    
    if (!move) return false;

    setGame(gameCopy);
    
    const newStats = {
      ...gameStats,
      moves: gameStats.moves + 1,
      captures: move.captured ? gameStats.captures + 1 : gameStats.captures
    };
    setGameStats(newStats);

    // Check for game over
    if (gameCopy.isGameOver()) {
      return true;
    }

    // Trigger AI move
    setIsThinking(true);
    
    // Use setTimeout to prevent UI blocking and simulate thinking
    setTimeout(() => {
      const aiMove = ai.getBestMove(gameCopy);
      if (aiMove) {
        const gameAfterAi = new Chess(gameCopy.fen());
        gameAfterAi.move(aiMove);
        setGame(gameAfterAi);
      }
      setIsThinking(false);
    }, 800); // Increased thinking time for better user experience

    return true;
  }, [game, gameStats, isThinking, ai]);

  return {
    game,
    isThinking,
    gameStats,
    startNewGame,
    makePlayerMove
  };
}