'use client';

import { Chessboard } from 'react-chessboard';
import type { PieceDropHandlerArgs } from 'react-chessboard';

interface ChessboardWrapperProps {
  position: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string, piece: string) => boolean;
  boardOrientation: 'white' | 'black';
}

export default function ChessboardWrapper({ position, onPieceDrop, boardOrientation }: ChessboardWrapperProps) {
  const handlePieceDrop = ({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    console.log('ChessboardWrapper: Piece drop event', {
      piece: piece.pieceType,
      sourceSquare,
      targetSquare
    });

    if (!targetSquare) {
      console.log('ChessboardWrapper: No target square, returning false');
      return false;
    }

    const result = onPieceDrop(sourceSquare, targetSquare, piece.pieceType);
    console.log('ChessboardWrapper: onPieceDrop result:', result);
    return result;
  };

  return (
    <Chessboard
      options={{
        position,
        onPieceDrop: handlePieceDrop,
        boardOrientation,
        allowDragging: true
      }}
    />
  );
}