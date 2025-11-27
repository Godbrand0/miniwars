'use client';

import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAccount } from 'wagmi';
import { useGameContract } from '@/hooks/useGameContract';
import type { PieceDropHandlerArgs } from 'react-chessboard';

interface ChessBoardProps {
  gameId: number;
  player1: string;
  player2: string;
}

const PIECE_VALUES = {
  p: 0.05, // Pawn
  n: 0.15, // Knight
  b: 0.15, // Bishop
  r: 0.25, // Rook
  q: 0.50, // Queen
  k: 0,    // King
};

const PIECE_TYPE_MAP: Record<string, number> = {
  p: 0, // PAWN
  n: 1, // KNIGHT
  b: 2, // BISHOP
  r: 3, // ROOK
  q: 4, // QUEEN
  k: 5, // KING
};

export default function ChessBoardPaymaster({ gameId, player1, player2 }: ChessBoardProps) {
  const [game, setGame] = useState(new Chess());
  const [player1Balance, setPlayer1Balance] = useState(2.5);
  const [player2Balance, setPlayer2Balance] = useState(2.5);
  const [captureAnimations, setCaptureAnimations] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAppliedMoveNumber, setLastAppliedMoveNumber] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { address } = useAccount();
  const { capturePiecePaymaster, loading, isReady, isSessionValid } = useGameContract();

  const isMyTurn = () => {
    const turn = game.turn();
    if (turn === 'w' && address === player1) return true;
    if (turn === 'b' && address === player2) return true;
    return false;
  };

  const showCaptureAnimation = (piece: string, value: number) => {
    const animationId = `capture-${Date.now()}`;
    setCaptureAnimations(prev => [...prev, animationId]);
    
    setTimeout(() => {
      setCaptureAnimations(prev => prev.filter(id => id !== animationId));
    }, 2000);
  };

  // Submit move to API
  const submitMove = async (from: string, to: string, promotion?: string) => {
    try {
      const response = await fetch(`/api/games/${gameId}/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to,
          promotion,
          player: address
        })
      });

      if (!response.ok) {
        console.error('Failed to submit move to API');
      } else {
        const data = await response.json();
        console.log('[Move Sync] Move submitted:', data.move);
      }
    } catch (error) {
      console.error('[Move Sync] Error submitting move:', error);
    }
  };

  // Fetch and apply opponent moves
  const fetchAndApplyMoves = async () => {
    if (isSyncing) return; // Prevent concurrent syncs
    
    try {
      setIsSyncing(true);
      const response = await fetch(`/api/games/${gameId}/moves`);
      
      if (!response.ok) {
        console.error('Failed to fetch moves from API');
        return;
      }

      const data = await response.json();
      const moves = data.moves || [];

      // Apply only new moves from opponent
      const newMoves = moves.filter((move: any) => 
        move.moveNumber > lastAppliedMoveNumber &&
        move.player.toLowerCase() !== address?.toLowerCase()
      );

      if (newMoves.length > 0) {
        console.log(`[Move Sync] Applying ${newMoves.length} new opponent move(s)`);
        
        const gameCopy = new Chess(game.fen());
        
        for (const move of newMoves) {
          const result = gameCopy.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion || 'q'
          });

          if (result) {
            console.log(`[Move Sync] Applied move ${move.moveNumber}: ${move.from} -> ${move.to}`);
          } else {
            console.error(`[Move Sync] Failed to apply move ${move.moveNumber}`);
          }
        }

        setGame(gameCopy);
        setLastAppliedMoveNumber(moves[moves.length - 1].moveNumber);
      }
    } catch (error) {
      console.error('[Move Sync] Error fetching moves:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Poll for new moves every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAndApplyMoves();
    }, 2000);

    // Initial fetch
    fetchAndApplyMoves();

    return () => clearInterval(interval);
  }, [gameId, lastAppliedMoveNumber, address, game.fen()]);

  function makeMove({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    // Guard against null targetSquare
    if (!targetSquare) return false;
    if (!isMyTurn()) {
      alert('Not your turn!');
      return false;
    }

    if (isProcessing || !isReady) {
      alert('Transaction in progress or session not ready...');
      return false;
    }

    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    if (move === null) return false;

    setGame(gameCopy);

    // Submit move to API for real-time sync
    submitMove(sourceSquare, targetSquare, move.promotion);

    // Handle capture with paymaster (gasless + no signature)
    if (move.captured) {
      const capturedValue = PIECE_VALUES[move.captured as keyof typeof PIECE_VALUES];
      const captor = address;
      const victim = captor === player1 ? player2 : player1;
      const pieceType = PIECE_TYPE_MAP[move.captured];

      setIsProcessing(true);

      // Handle async capture separately to not block the move
      (async () => {
        try {
          // Submit gasless capture transaction (no user signature needed!)
          const txHash = await capturePiecePaymaster(gameId, captor || address || '', pieceType);
          
          // Update UI immediately (optimistic)
          if (captor === player1) {
            setPlayer1Balance(prev => prev + capturedValue);
            setPlayer2Balance(prev => prev - capturedValue);
          } else {
            setPlayer2Balance(prev => prev + capturedValue);
            setPlayer1Balance(prev => prev - capturedValue);
          }

          // Show capture animation
          showCaptureAnimation(move.captured!, capturedValue);
          
          console.log('Gasless capture successful:', txHash);
          
        } catch (error) {
          console.error('Gasless capture failed:', error);
          alert('Capture failed. Please try again.');
        } finally {
          setIsProcessing(false);
        }
      })();
    }

    // Check for game over
    if (gameCopy.isGameOver()) {
      const winner = gameCopy.turn() === 'w' ? player2 : player1;
      setTimeout(() => {
        if (gameCopy.isCheckmate()) {
          alert(`Checkmate! ${winner === address ? 'You' : 'Opponent'} won!`);
        } else {
          alert('Game ended in a draw!');
        }
      }, 500);
    }

    return true;
  }

  if (!isSessionValid()) {
    return (
      <div className="flex flex-col items-center gap-6 p-4">
        <div className="w-full max-w-md">
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <span className="text-sm font-semibold">⚠️ Session Expired</span>
            <p className="text-xs">Please refresh to start a new game session</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="w-full max-w-md">
        {/* Gasless indicator */}
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded flex justify-between items-center">
          <div>
            <span className="text-sm font-semibold">🔄 Gasless Mode Active</span>
            <p className="text-xs">No gas fees for captures!</p>
          </div>
          {isSyncing && (
            <div className="text-xs bg-white/50 px-2 py-1 rounded animate-pulse">
              Syncing...
            </div>
          )}
        </div>

        <div className="mb-4 flex justify-between text-sm font-semibold">
          <div className="flex flex-col">
            <span>Player 1 {address === player1 && '(You)'}</span>
            <span className="text-green-600">${player1Balance.toFixed(2)} cUSD</span>
          </div>
          <div className="flex flex-col text-right">
            <span>Player 2 {address === player2 && '(You)'}</span>
            <span className="text-green-600">${player2Balance.toFixed(2)} cUSD</span>
          </div>
        </div>

        {/* Capture Animations */}
        {captureAnimations.map(id => (
          <div key={id} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
            <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce">
              +${PIECE_VALUES[id.split('-')[1] as keyof typeof PIECE_VALUES]} cUSD
            </div>
          </div>
        ))}

        <Chessboard
          options={{
            position: game.fen(),
            onPieceDrop: makeMove,
            boardOrientation: address === player1 ? 'white' : 'black'
          }}
        />

        <div className="mt-4 text-center text-sm">
          {isProcessing || loading ? (
            <span className="text-yellow-600 font-bold">Processing gasless transaction...</span>
          ) : isMyTurn() ? (
            <span className="text-green-600 font-bold">Your turn! (Gasless)</span>
          ) : (
            <span className="text-gray-500">Opponent's turn...</span>
          )}
        </div>
      </div>
    </div>
  );
}