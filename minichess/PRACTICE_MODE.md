# MiniChess Practice Mode

## Overview

The Practice Mode feature allows users to play chess against a computer opponent to improve their skills without any blockchain transactions or gas fees. This feature runs entirely locally in the browser.

## Features

### Chess AI Engine
- **Algorithm**: Minimax with alpha-beta pruning
- **Search Depth**: 3 plies (adjustable in `chess-ai.ts`)
- **Position Evaluation**: 
  - Piece values and position bonuses
  - Center control evaluation
  - King safety considerations
  - Quiescence search to avoid horizon effect

### Game Statistics
- Tracks win/loss/draw ratio
- Records average moves per game
- Monitors game duration
- Stores recent game history
- Persistent storage using localStorage

### User Interface
- Clean, responsive design matching the main application
- Real-time game status updates
- Move counter and capture tracking
- Timer display
- Statistics dashboard with toggle visibility

## Implementation Details

### File Structure
```
src/
├── lib/
│   ├── chess-ai.ts          # AI engine implementation
│   └── practice-stats.ts     # Statistics management
├── hooks/
│   └── usePracticeGame.ts   # Practice game state management
└── components/
    ├── PracticeBoard.tsx      # Main practice game UI
    └── practice-stats.tsx     # Statistics display component
```

### Key Components

#### ChessAI Class
- `getBestMove()`: Calculates the best move for current position
- `minimax()`: Core search algorithm with alpha-beta pruning
- `evaluatePosition()`: Position evaluation function
- `quiescenceSearch()`: Extends search at leaf nodes for captures

#### usePracticeGame Hook
- Manages game state and AI integration
- Handles move validation and execution
- Tracks game statistics
- Saves game results to localStorage

#### PracticeStatsManager
- Handles persistent storage of game statistics
- Provides analytics and performance metrics
- Manages recent game history

## Usage

1. From the main menu, click "Practice vs Computer"
2. The game starts immediately with you playing as White
3. Make moves by dragging and dropping pieces
4. The AI will respond after a brief thinking period
5. View your statistics by clicking "Show Stats"
6. Start a new game anytime with "New Game"

## AI Difficulty

The current AI difficulty is set to provide a challenging but fair experience:
- Search depth of 3 plies provides good tactical awareness
- Position evaluation considers material, position, and king safety
- Quiescence search prevents tactical blunders
- Thinking time of 800ms simulates human consideration

To adjust difficulty:
1. Modify `MAX_DEPTH` in `chess-ai.ts` (higher = harder)
2. Adjust position evaluation weights
3. Modify thinking time in `usePracticeGame.ts`

## Technical Notes

- All games run locally without blockchain interaction
- Statistics are stored in browser localStorage
- AI calculations use setTimeout to prevent UI blocking
- The chess.js library handles all chess rules and validation
- react-chessboard provides the interactive chess board UI

## Future Enhancements

Potential improvements for future versions:
- Multiple difficulty levels
- Opening book integration
- Endgame tablebase support
- Puzzle mode
- Analysis engine integration
- Cloud statistics sync
- Achievement system