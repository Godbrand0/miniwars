import { Chess } from 'chess.js';

export class ChessAI {
  private static readonly MAX_DEPTH = 3; // Increased depth for better play
  private static readonly PIECE_VALUES: Record<string, number> = {
    p: 1,   // Pawn
    n: 3,   // Knight
    b: 3,   // Bishop
    r: 5,   // Rook
    q: 9,   // Queen
    k: 100, // King
  };

  // Position evaluation bonuses
  private static readonly POSITION_BONUSES = {
    p: [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [5,  5,  5,  5,  5,  5,  5,  5],
      [1,  1,  2,  3,  3,  2,  1,  1],
      [0.5,0.5, 1,  2.5,2.5, 1,  0.5,0.5],
      [0,  0,  0,  2,  2,  0,  0,  0],
      [0.5,-0.5,-1,  0,  0, -1, -0.5,0.5],
      [0.5, 1,  1, -2, -2,  1,  1,  0.5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ],
    n: [
      [-5,-4,-3,-3,-3,-3,-4,-5],
      [-4,-2, 0,  0,  0,  0,-2,-4],
      [-3, 0,  1,  1.5,1.5, 1,  0,-3],
      [-3, 0.5,1.5, 2,  2, 1.5,0.5,-3],
      [-3, 0,  1.5, 2,  2, 1.5,  0,-3],
      [-3, 0.5, 1,  1.5,1.5, 1,  0.5,-3],
      [-4,-2,  0,  0.5,0.5, 0, -2,-4],
      [-5,-4,-3,-3,-3,-3,-4,-5]
    ]
  };

  getBestMove(game: Chess): string | null {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    let bestMove = null;
    let bestValue = -Infinity;

    for (const move of moves) {
      const gameCopy = new Chess(game.fen());
      gameCopy.move(move);
      
      const moveValue = this.minimax(
        gameCopy, 
        ChessAI.MAX_DEPTH - 1, 
        -Infinity, 
        Infinity, 
        false
      );

      if (moveValue > bestValue) {
        bestValue = moveValue;
        bestMove = move.san;
      }
    }

    return bestMove;
  }

  private minimax(
    game: Chess,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
  ): number {
    // Base case: leaf node or game over
    if (depth === 0 || game.isGameOver()) {
      // Use quiescence search at leaf nodes to avoid horizon effect
      if (!game.isGameOver() && depth === 0) {
        return this.quiescenceSearch(game, alpha, beta, isMaximizing);
      }
      return this.evaluatePosition(game);
    }

    const moves = game.moves({ verbose: true });

    if (isMaximizing) {
      let maxEval = -Infinity;
      
      for (const move of moves) {
        const gameCopy = new Chess(game.fen());
        gameCopy.move(move);
        
        const evaluation = this.minimax(gameCopy, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        
        if (beta <= alpha) {
          break; // Alpha-beta pruning
        }
      }
      
      return maxEval;
    } else {
      let minEval = Infinity;
      
      for (const move of moves) {
        const gameCopy = new Chess(game.fen());
        gameCopy.move(move);
        
        const evaluation = this.minimax(gameCopy, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        
        if (beta <= alpha) {
          break; // Alpha-beta pruning
        }
      }
      
      return minEval;
    }
  }

  private evaluatePosition(game: Chess): number {
    if (game.isCheckmate()) {
      return game.turn() === 'w' ? -1000 : 1000;
    }

    if (game.isDraw()) {
      return 0;
    }

    let score = 0;
    const board = game.board();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;

        const pieceValue = ChessAI.PIECE_VALUES[piece.type];
        const positionBonus = this.getPositionBonus(piece.type, piece.color, row, col);
        const totalValue = pieceValue + positionBonus;

        score += piece.color === 'w' ? totalValue : -totalValue;
      }
    }

    return score;
  }

  private getPositionBonus(pieceType: string, color: string, row: number, col: number): number {
    // Use position bonuses for pawns and knights, simplified for other pieces
    if (pieceType === 'p') {
      const bonusTable = ChessAI.POSITION_BONUSES.p;
      return color === 'w'
        ? bonusTable[row][col]
        : bonusTable[7 - row][col];
    }

    if (pieceType === 'n') {
      const bonusTable = ChessAI.POSITION_BONUSES.n;
      return color === 'w'
        ? bonusTable[row][col]
        : bonusTable[7 - row][col];
    }

    // Enhanced position bonuses for other pieces
    const centerDistance = Math.abs(3.5 - row) + Math.abs(3.5 - col);
    const centerControl = (7 - centerDistance) * 0.2; // Increased center control bonus
    
    // Additional positional considerations
    let bonus = centerControl;
    
    // King safety - encourage king to stay on back rank
    if (pieceType === 'k') {
      const backRank = color === 'w' ? 0 : 7;
      const kingFile = col;
      // Prefer castling corners
      if (row === backRank && (kingFile === 1 || kingFile === 6)) {
        bonus += 0.5;
      }
      // Penalize exposed king
      if (Math.abs(row - backRank) > 1) {
        bonus -= 0.3;
      }
    }
    
    // Rook on open files
    if (pieceType === 'r') {
      bonus += 0.2; // General rook bonus
    }
    
    // Queen development
    if (pieceType === 'q') {
      // Slightly penalize early queen development
      if (row > 2 && row < 5) {
        bonus -= 0.1;
      }
    }
    
    return bonus;
  }

  // Add a simple quiescence search to avoid horizon effect
  private quiescenceSearch(game: Chess, alpha: number, beta: number, isMaximizing: boolean): number {
    const standPat = this.evaluatePosition(game);
    
    if (isMaximizing) {
      if (standPat >= beta) return beta;
      alpha = Math.max(alpha, standPat);
    } else {
      if (standPat <= alpha) return alpha;
      beta = Math.min(beta, standPat);
    }
    
    // Only consider capture moves in quiescence
    const moves = game.moves({ verbose: true }).filter(move => move.captured);
    
    if (moves.length === 0) return standPat;
    
    if (isMaximizing) {
      let maxEval = standPat;
      for (const move of moves) {
        const gameCopy = new Chess(game.fen());
        gameCopy.move(move);
        const evaluation = this.quiescenceSearch(gameCopy, alpha, beta, false);
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = standPat;
      for (const move of moves) {
        const gameCopy = new Chess(game.fen());
        gameCopy.move(move);
        const evaluation = this.quiescenceSearch(gameCopy, alpha, beta, true);
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }
}