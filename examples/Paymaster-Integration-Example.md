# Paymaster Integration Example for MiniChess

This file provides concrete examples of how to integrate Pimlico paymaster with the existing MiniChess implementation.

---

## 🔄 Smart Contract Modifications

### Updated MiniChessEscrowSeamless.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/**
 * @title MiniChessEscrowPaymaster
 * @dev Enhanced escrow with paymaster support for gasless gameplay
 */
contract MiniChessEscrowPaymaster is ReentrancyGuard {
    
    // cUSD token address on Celo Mainnet
    address public constant CUSD_TOKEN = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
    // For Alfajores testnet: 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
    
    IERC20 public cUSD;
    IEntryPoint public entryPoint;
    
    // Piece values in cUSD (with 18 decimals)
    uint256 public constant PAWN_VALUE = 0.05 ether;    // 8 pawns = 0.4 ether
    uint256 public constant KNIGHT_VALUE = 0.15 ether;  // 2 knights = 0.3 ether
    uint256 public constant BISHOP_VALUE = 0.15 ether;  // 2 bishops = 0.3 ether
    uint256 public constant ROOK_VALUE = 0.25 ether;    // 2 rooks = 0.5 ether
    uint256 public constant QUEEN_VALUE = 0.5 ether;    // 1 queen = 0.5 ether
    // King has no capture value
    // Total: 0.4 + 0.3 + 0.3 + 0.5 + 0.5 = 2.0 ether (capturable pieces)
    
    // Total escrow needed per player (16 pieces)
    uint256 public constant ESCROW_AMOUNT = 2.5 ether;
    
    enum PieceType { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING }
    enum GameStatus { WAITING, ACTIVE, FINISHED, CANCELLED }
    
    struct Game {
        address player1;
        address player2;
        uint256 player1Escrow;
        uint256 player2Escrow;
        uint256 player1Balance;
        uint256 player2Balance;
        GameStatus status;
        address winner;
        uint256 createdAt;
        mapping(address => bool) authorized; // Session key authorization
    }
    
    mapping(uint256 => Game) public games;
    uint256 public gameCounter;
    mapping(uint256 => mapping(bytes32 => bool)) public processedCaptures; // Prevent duplicates
    
    // Events
    event GameCreated(uint256 indexed gameId, address indexed player1);
    event PlayerJoined(uint256 indexed gameId, address indexed player2);
    event PieceCaptured(
        uint256 indexed gameId,
        address indexed captor,
        PieceType pieceType,
        uint256 amount
    );
    event GameEnded(
        uint256 indexed gameId,
        address indexed winner,
        uint256 player1Payout,
        uint256 player2Payout
    );
    event GameCancelled(uint256 indexed gameId);
    event SessionAuthorized(uint256 indexed gameId, address indexed player);
    
    constructor(address _entryPoint) {
        cUSD = IERC20(CUSD_TOKEN);
        entryPoint = IEntryPoint(_entryPoint);
    }
    
    /**
     * @dev Create a new game and deposit escrow (paymaster compatible)
     */
    function createGame() external nonReentrant returns (uint256) {
        require(
            cUSD.transferFrom(msg.sender, address(this), ESCROW_AMOUNT),
            "Escrow transfer failed"
        );
        
        gameCounter++;
        uint256 gameId = gameCounter;
        
        Game storage game = games[gameId];
        game.player1 = msg.sender;
        game.player1Escrow = ESCROW_AMOUNT;
        game.player1Balance = ESCROW_AMOUNT;
        game.status = GameStatus.WAITING;
        game.winner = address(0);
        game.createdAt = block.timestamp;
        game.authorized[msg.sender] = true; // Creator is authorized
        
        emit GameCreated(gameId, msg.sender);
        return gameId;
    }
    
    /**
     * @dev Join an existing game
     */
    function joinGame(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        require(game.status == GameStatus.WAITING, "Game not available");
        require(game.player1 != msg.sender, "Cannot play against yourself");
        require(game.player2 == address(0), "Game already full");
        
        require(
            cUSD.transferFrom(msg.sender, address(this), ESCROW_AMOUNT),
            "Escrow transfer failed"
        );
        
        game.player2 = msg.sender;
        game.player2Escrow = ESCROW_AMOUNT;
        game.player2Balance = ESCROW_AMOUNT;
        game.status = GameStatus.ACTIVE;
        game.authorized[msg.sender] = true; // Joiner is authorized
        
        emit PlayerJoined(gameId, msg.sender);
    }
    
    /**
     * @dev Gasless piece capture using paymaster
     */
    function capturePiecePaymaster(
        uint256 gameId,
        address captor,
        PieceType pieceType,
        bytes calldata signature
    ) external nonReentrant {
        require(msg.sender == address(entryPoint), "Only entry point can call");
        
        Game storage game = games[gameId];
        require(game.status == GameStatus.ACTIVE, "Game not active");
        require(game.authorized[captor], "Not authorized");
        require(
            captor == game.player1 || captor == game.player2,
            "Invalid captor"
        );
        
        // Verify capture signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            "CAPTURE_PIECE", gameId, captor, uint256(pieceType), block.chainid
        ));
        
        address signer = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(messageHash),
            signature
        );
        
        require(signer == captor, "Invalid capture signature");
        
        uint256 captureValue = getPieceValue(pieceType);
        require(captureValue > 0, "Invalid piece type");
        
        // Update balances
        if (captor == game.player1) {
            require(game.player2Balance >= captureValue, "Insufficient balance");
            game.player2Balance -= captureValue;
            game.player1Balance += captureValue;
        } else {
            require(game.player1Balance >= captureValue, "Insufficient balance");
            game.player1Balance -= captureValue;
            game.player2Balance += captureValue;
        }
        
        emit PieceCaptured(gameId, captor, pieceType, captureValue);
    }
    
    /**
     * @dev Get piece value
     */
    function getPieceValue(PieceType pieceType) public pure returns (uint256) {
        if (pieceType == PieceType.PAWN) return PAWN_VALUE;
        if (pieceType == PieceType.KNIGHT) return KNIGHT_VALUE;
        if (pieceType == PieceType.BISHOP) return BISHOP_VALUE;
        if (pieceType == PieceType.ROOK) return ROOK_VALUE;
        if (pieceType == PieceType.QUEEN) return QUEEN_VALUE;
        return 0; // King has no capture value
    }
    
    /**
     * @dev Get game details
     */
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }
    
    /**
     * @dev Check if player is authorized for game
     */
    function isAuthorized(uint256 gameId, address player) external view returns (bool) {
        return games[gameId].authorized[player];
    }
}
```

---

## 🎮 Frontend Integration

### Enhanced ChessBoard Component with Paymaster

```typescript
// components/ChessBoardPaymaster.tsx
'use client';

import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAccount } from 'wagmi';
import { useGameContractPaymaster } from '@/hooks/useGameContractPaymaster';

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
  
  const { address } = useAccount();
  const { capturePiecePaymaster, loading } = useGameContractPaymaster();

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

  const signCaptureMessage = async (gameId: number, pieceType: number) => {
    if (!address || !window.ethereum) throw new Error('Wallet not available');
    
    const message = `CAPTURE_PIECE:${gameId}:${address}:${pieceType}:44787`;
    
    return await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });
  };

  async function makeMove(sourceSquare: string, targetSquare: string) {
    if (!isMyTurn()) {
      alert('Not your turn!');
      return false;
    }

    if (isProcessing) {
      alert('Transaction in progress...');
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

    // Handle capture with paymaster
    if (move.captured) {
      const capturedValue = PIECE_VALUES[move.captured as keyof typeof PIECE_VALUES];
      const captor = address;
      const victim = captor === player1 ? player2 : player1;
      const pieceType = PIECE_TYPE_MAP[move.captured];

      setIsProcessing(true);

      try {
        // Sign the capture message
        const signature = await signCaptureMessage(gameId, pieceType);
        
        // Submit gasless capture transaction
        const txHash = await capturePiecePaymaster(gameId, captor!, pieceType, signature);
        
        // Update UI immediately (optimistic)
        if (captor === player1) {
          setPlayer1Balance(prev => prev + capturedValue);
          setPlayer2Balance(prev => prev - capturedValue);
        } else {
          setPlayer2Balance(prev => prev + capturedValue);
          setPlayer1Balance(prev => prev - capturedValue);
        }

        // Show capture animation
        showCaptureAnimation(move.captured, capturedValue);
        
        console.log('Gasless capture successful:', txHash);
        
      } catch (error) {
        console.error('Gasless capture failed:', error);
        alert('Capture failed. Please try again.');
      } finally {
        setIsProcessing(false);
      }
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

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="w-full max-w-md">
        {/* Gasless indicator */}
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <span className="text-sm font-semibold">🔄 Gasless Mode Active</span>
          <p className="text-xs">No gas fees for captures!</p>
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
          position={game.fen()}
          onPieceDrop={makeMove}
          boardOrientation={address === player1 ? 'white' : 'black'}
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
```

### Paymaster Game Hook

```typescript
// hooks/useGameContractPaymaster.ts
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { createGameAccount } from '@/lib/smart-account';
import { parseEther } from 'viem';

export function useGameContractPaymaster() {
  const { address } = useAccount();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(false);

  // Initialize smart account with paymaster
  async function initialize(wallet) {
    setLoading(true);
    try {
      const smartClient = await createGameAccount(wallet);
      setClient(smartClient);
    } catch (error) {
      console.error('Failed to create smart account:', error);
    } finally {
      setLoading(false);
    }
  }

  // Gasless capture transaction
  async function capturePiecePaymaster(gameId: number, captor: string, pieceType: number, signature: string) {
    if (!client) throw new Error('Client not initialized');

    const tx = await client.writeContract({
      address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
      abi: [
        {
          "inputs": [
            {"name": "gameId", "type": "uint256"},
            {"name": "captor", "type": "address"},
            {"name": "pieceType", "type": "uint8"},
            {"name": "signature", "type": "bytes"}
          ],
          "name": "capturePiecePaymaster",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ],
      functionName: 'capturePiecePaymaster',
      args: [BigInt(gameId), captor as `0x${string}`, pieceType, signature as `0x${string}`]
    });

    return tx;
  }

  // Auto-initialize when wallet connects
  useEffect(() => {
    if (address && window.ethereum) {
      initialize(window.ethereum);
    }
  }, [address]);

  return { 
    initialize, 
    capturePiecePaymaster, 
    loading,
    isReady: !!client
  };
}
```

---

## 🔄 Migration Guide

### From Relayer to Paymaster

1. **Update Smart Contract**
   ```bash
   # Deploy new contract with paymaster support
   forge script script/DeployPaymaster.s.sol --rpc-url alfajores --broadcast --verify
   ```

2. **Update Frontend**
   ```typescript
   // Replace relayer hooks with paymaster hooks
   import { useGameContractPaymaster } from '@/hooks/useGameContractPaymaster'
   ```

3. **Environment Variables**
   ```bash
   # Add to .env.local
   NEXT_PUBLIC_PIMLICO_API_KEY=pim_xxxxxxxxxx
   NEXT_PUBLIC_CHAIN_ENV=testnet
   ```

4. **Component Updates**
   ```typescript
   // Replace ChessBoard with ChessBoardPaymaster
   import ChessBoardPaymaster from '@/components/ChessBoardPaymaster'
   ```

### Hybrid Approach (Both Systems)

You can run both systems in parallel:

```typescript
// hooks/useHybridGameContract.ts
export function useHybridGameContract() {
  const [usePaymaster, setUsePaymaster] = useState(true);
  
  const paymasterHook = useGameContractPaymaster();
  const relayerHook = useGameContract(); // Existing relayer hook
  
  const capturePiece = usePaymaster 
    ? paymasterHook.capturePiecePaymaster
    : relayerHook.recordCapture;
  
  return {
    capturePiece,
    usePaymaster,
    setUsePaymaster,
    loading: paymasterHook.loading || relayerHook.loading
  };
}
```

---

## 📊 Performance Comparison

| Feature | Relayer | Paymaster |
|---------|---------|----------|
| Gas Cost | Free (sponsored) | Free (sponsored) |
| Infrastructure | Required | None |
| Setup Complexity | High | Low |
| Transaction Speed | Fast | Faster |
| User Experience | Good | Excellent |
| Cost Predictability | Variable | Fixed |
| Maintenance | Ongoing | Minimal |

---

## 🚀 Deployment Checklist

### Smart Contract
- [ ] Deploy paymaster-compatible contract
- [ ] Verify on block explorer
- [ ] Update contract address in frontend

### Frontend
- [ ] Install paymaster dependencies
- [ ] Configure Pimlico client
- [ ] Update game components
- [ ] Test gasless transactions

### Production
- [ ] Fund paymaster account
- [ ] Set spending limits
- [ ] Monitor usage
- [ ] Set up alerts

---

## 🧪 Testing

### Test Paymaster Integration

```typescript
// tests/paymaster.test.ts
import { render, screen, fireEvent } from '@testing-library/react';
import ChessBoardPaymaster from '@/components/ChessBoardPaymaster';

describe('Paymaster Integration', () => {
  it('should handle gasless capture', async () => {
    const mockCapture = jest.fn().mockResolvedValue('0x123...');
    
    render(
      <ChessBoardPaymaster 
        gameId={1}
        player1="0x123..."
        player2="0x456..."
      />
    );
    
    // Simulate capture
    fireEvent.click(screen.getByTestId('capture-pawn'));
    
    await waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith(
        1,
        '0x123...',
        0, // PAWN
        expect.any(String) // signature
      );
    });
  });
});
```

---

## 📚 Additional Resources

- [Pimlico Documentation](https://docs.pimlico.io)
- [ERC-4337 Standard](https://eips.ethereum.org/EIPS/eip-4337)
- [Celo Account Abstraction](https://docs.celo.org/protocol/transaction/erc-4337)
- [Permissionless.js Guide](https://docs.pimlico.io/permissionless)