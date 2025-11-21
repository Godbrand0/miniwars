// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/**
 * @title MiniChessEscrowPaymaster
 * @dev Gasless chess escrow with paymaster support and comprehensive player statistics
 *
 * Features:
 * - Single signature game creation and joining
 * - Gasless gameplay via paymaster + session keys
 * - On-chain player statistics tracking
 * - Piece capture with instant cUSD rewards
 * - Game timeout protection
 * - Comprehensive game history
 *
 * @notice This contract enables gasless chess gameplay on Celo with cUSD rewards
 * @author MiniChess Team
 */
contract MiniChessEscrowPaymaster is ReentrancyGuard {
    
    // ============ Constants ============
    
    /// @dev cUSD token address on Celo Alfajores testnet
    address public constant CUSD_TOKEN = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;
    
    /// @dev ERC20 token interface for cUSD
    IERC20 public immutable cUSD;
    
    /// @dev EntryPoint interface for account abstraction
    IEntryPoint public immutable entryPoint;
    
    // ============ Piece Values ============
    
    /// @dev Monetary value of each chess piece in cUSD (18 decimals)
    uint256 public constant PAWN_VALUE = 0.05 ether;   // $0.05 cUSD
    uint256 public constant KNIGHT_VALUE = 0.15 ether; // $0.15 cUSD
    uint256 public constant BISHOP_VALUE = 0.15 ether; // $0.15 cUSD
    uint256 public constant ROOK_VALUE = 0.25 ether;   // $0.25 cUSD
    uint256 public constant QUEEN_VALUE = 0.5 ether;   // $0.50 cUSD
    
    // ============ Game Constants ============
    
    /// @dev Escrow amount required from each player to start a game
    uint256 public constant ESCROW_AMOUNT = 2.5 ether; // $2.50 cUSD
    
    /// @dev Maximum time between moves before game can be claimed as timeout
    uint256 public constant GAME_TIMEOUT = 30 minutes;
    
    // ============ Enums ============
    
    /// @dev Types of chess pieces
    enum PieceType { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING }
    
    /// @dev Game lifecycle states
    enum GameStatus { WAITING, ACTIVE, FINISHED, CANCELLED }
    
    // ============ Structs ============
    
    /**
     * @dev Game state structure
     * Stores all relevant information about a chess game
     */
    struct Game {
        address player1;           // First player (game creator)
        address player2;           // Second player (joins existing game)
        uint256 player1Escrow;     // Initial escrow from player1
        uint256 player2Escrow;     // Initial escrow from player2
        uint256 player1Balance;     // Current balance after captures
        uint256 player2Balance;     // Current balance after captures
        GameStatus status;          // Current game state
        address winner;             // Winner address (set when finished)
        uint256 createdAt;          // Game creation timestamp
        uint256 lastMoveAt;        // Last move timestamp (for timeout)
    }
    
    /**
     * @dev Player statistics structure
     * Tracks comprehensive player performance metrics
     */
    struct PlayerStats {
        uint256 gamesPlayed;        // Total games participated in
        uint256 gamesWon;          // Total games won
        uint256 gamesLost;         // Total games lost
        uint256 totalEarned;        // Total cUSD earned from wins (profit)
        uint256 totalLost;          // Total cUSD lost from losses (loss)
    }
    
    // ============ Storage ============
    
    /// @dev Mapping from game ID to game data
    mapping(uint256 => Game) public games;
    
    /// @dev Mapping from game ID to player authorization status
    mapping(uint256 => mapping(address => bool)) public authorized;
    
    /// @dev Mapping to prevent duplicate capture processing
    mapping(uint256 => mapping(bytes32 => bool)) public processedCaptures;
    
    /// @dev Mapping from player address to their statistics
    mapping(address => PlayerStats) public playerStats;
    
    /// @dev Mapping from player address to their game history (game IDs)
    mapping(address => uint256[]) public playerGameHistory;
    
    /// @dev Counter for generating unique game IDs
    uint256 public gameCounter;
    
    // ============ Events ============
    
    /// @dev Emitted when a new game is created
    event GameCreated(uint256 indexed gameId, address indexed player1);
    
    /// @dev Emitted when a player joins an existing game
    event PlayerJoined(uint256 indexed gameId, address indexed player2);
    
    /// @dev Emitted when a piece is captured (gasless via paymaster)
    event PieceCaptured(
        uint256 indexed gameId,
        address indexed captor,
        PieceType pieceType,
        uint256 amount
    );
    
    /// @dev Emitted when a game ends normally
    event GameEnded(
        uint256 indexed gameId,
        address indexed winner,
        uint256 player1Payout,
        uint256 player2Payout
    );
    
    /// @dev Emitted when a waiting game is cancelled
    event GameCancelled(uint256 indexed gameId);
    
    /// @dev Emitted when a player's session is authorized
    event SessionAuthorized(uint256 indexed gameId, address indexed player);
    
    /// @dev Emitted when a game is won by timeout
    event GameTimedOut(uint256 indexed gameId, address indexed claimer);
    
    /// @dev Emitted when player statistics are updated
    event StatsUpdated(
        address indexed player,
        uint256 gamesPlayed,
        uint256 gamesWon,
        uint256 gamesLost,
        uint256 totalEarned,
        uint256 totalLost
    );
    
   
    // ============ Constructor ============
    
    /**
     * @dev Initialize the contract with EntryPoint address
     * @param _entryPoint The EntryPoint contract address for account abstraction
     */
    constructor(address _entryPoint) {
        cUSD = IERC20(CUSD_TOKEN);
        entryPoint = IEntryPoint(_entryPoint);
    }
    
    // ============ Game Management ============
    
    /**
     * @dev Create a new game with session authorization (single signature)
     * Combines session key authorization and game creation in one transaction
     *
     * @param sessionSignature Signature authorizing session for the new game
     * @return gameId The ID of the newly created game
     *
     * Requirements:
     * - Valid session signature from msg.sender
     * - Sufficient cUSD allowance for ESCROW_AMOUNT
     * - Transfers ESCROW_AMOUNT to contract
     *
     * Effects:
     * - Creates new game with WAITING status
     * - Authorizes msg.sender for gasless gameplay
     * - Emits GameCreated and SessionAuthorized events
     */
    function createGameWithSession(
        bytes calldata sessionSignature
    ) external nonReentrant returns (uint256) {
        bytes32 sessionMessageHash = keccak256(abi.encodePacked(
            "AUTHORIZE_SESSION", gameCounter + 1, block.chainid
        ));
        
        address sessionSigner = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(sessionMessageHash),
            sessionSignature
        );
        
        require(sessionSigner == msg.sender, "Invalid session signature");
        
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
        game.createdAt = block.timestamp;
        game.lastMoveAt = block.timestamp;
        
        authorized[gameId][msg.sender] = true;
        
        emit GameCreated(gameId, msg.sender);
        emit SessionAuthorized(gameId, msg.sender);
        return gameId;
    }
    
    /**
     * @dev Join an existing game with session authorization (single signature)
     * Combines session key authorization and game joining in one transaction
     *
     * @param gameId The ID of the game to join
     * @param sessionSignature Signature authorizing session for the game
     *
     * Requirements:
     * - Game must be in WAITING status
     * - Caller cannot be the game creator
     * - Valid session signature from msg.sender
     * - Sufficient cUSD allowance for ESCROW_AMOUNT
     *
     * Effects:
     * - Adds player2 to the game
     * - Changes status to ACTIVE
     * - Authorizes msg.sender for gasless gameplay
     * - Emits PlayerJoined and SessionAuthorized events
     */
    function joinGameWithSession(
        uint256 gameId,
        bytes calldata sessionSignature
    ) external nonReentrant {
        Game storage game = games[gameId];
        require(game.status == GameStatus.WAITING, "Game not available");
        require(game.player1 != msg.sender, "Cannot play yourself");
        require(game.player2 == address(0), "Game full");
        
        bytes32 sessionMessageHash = keccak256(abi.encodePacked(
            "AUTHORIZE_SESSION", gameId, block.chainid
        ));
        
        address sessionSigner = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(sessionMessageHash),
            sessionSignature
        );
        
        require(sessionSigner == msg.sender, "Invalid session signature");
        
        require(
            cUSD.transferFrom(msg.sender, address(this), ESCROW_AMOUNT),
            "Escrow transfer failed"
        );
        
        game.player2 = msg.sender;
        game.player2Escrow = ESCROW_AMOUNT;
        game.player2Balance = ESCROW_AMOUNT;
        game.status = GameStatus.ACTIVE;
        game.lastMoveAt = block.timestamp;
        
        authorized[gameId][msg.sender] = true;
        
        emit PlayerJoined(gameId, msg.sender);
        emit SessionAuthorized(gameId, msg.sender);
    }
    
    
    // ============ Gameplay Functions ============
    
    /**
     * @dev Capture a chess piece with gasless execution via paymaster
     * Only callable by the EntryPoint contract (account abstraction)
     *
     * @param gameId The game ID
     * @param captor The player capturing the piece
     * @param pieceType The type of piece being captured
     * @param signature Signature authorizing the capture
     *
     * Requirements:
     * - Must be called by EntryPoint contract
     * - Game must be ACTIVE
     * - Captor must be authorized for the game
     * - Valid signature from captor
     * - Capture not previously processed
     *
     * Effects:
     * - Transfers piece value from captured player to captor
     * - Updates last move timestamp
     * - Prevents duplicate captures
     * - Emits PieceCaptured event
     */
    function capturePiecePaymaster(
        uint256 gameId,
        address captor,
        PieceType pieceType,
        bytes calldata signature
    ) external nonReentrant {
        require(msg.sender == address(entryPoint), "Only entry point");
        
        Game storage game = games[gameId];
        require(game.status == GameStatus.ACTIVE, "Game not active");
        require(authorized[gameId][captor], "Not authorized");
        require(
            captor == game.player1 || captor == game.player2,
            "Invalid captor"
        );
        
        bytes32 captureId = keccak256(abi.encodePacked(
            gameId, captor, pieceType, block.timestamp
        ));
        require(!processedCaptures[gameId][captureId], "Already processed");
        processedCaptures[gameId][captureId] = true;
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            "CAPTURE_PIECE", gameId, captor, uint256(pieceType), block.chainid
        ));
        
        address signer = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(messageHash),
            signature
        );
        
        require(signer == captor, "Invalid signature");
        
        uint256 captureValue = getPieceValue(pieceType);
        require(captureValue > 0, "Invalid piece");
        
        if (captor == game.player1) {
            require(game.player2Balance >= captureValue, "Insufficient balance");
            game.player2Balance -= captureValue;
            game.player1Balance += captureValue;
        } else {
            require(game.player1Balance >= captureValue, "Insufficient balance");
            game.player1Balance -= captureValue;
            game.player2Balance += captureValue;
        }
        
        game.lastMoveAt = block.timestamp;
        
        emit PieceCaptured(gameId, captor, pieceType, captureValue);
    }
    
    // ============ Game Completion ============
    
    /**
     * @dev End a game and update player statistics
     * Can be called by either player when the game is complete
     *
     * @param gameId The game ID to end
     * @param winner The address of the winning player
     *
     * Requirements:
     * - Game must be ACTIVE
     * - Caller must be a player in the game
     * - Winner must be one of the players
     *
     * Effects:
     * - Updates player statistics for both players
     * - Adds game to both players' history
     * - Transfers final balances to players
     * - Emits GameEnded and StatsUpdated events
     */
    function endGame(uint256 gameId, address winner) external nonReentrant {
        Game storage game = games[gameId];
        require(game.status == GameStatus.ACTIVE, "Game not active");
        require(
            msg.sender == game.player1 || msg.sender == game.player2,
            "Not a player"
        );
        require(
            winner == game.player1 || winner == game.player2,
            "Invalid winner"
        );
        
        game.status = GameStatus.FINISHED;
        game.winner = winner;
        
        uint256 player1Payout = game.player1Balance;
        uint256 player2Payout = game.player2Balance;
        
        address loser = winner == game.player1 ? game.player2 : game.player1;
        uint256 winnerPayout = winner == game.player1 ? player1Payout : player2Payout;
        uint256 loserPayout = winner == game.player1 ? player2Payout : player1Payout;
        
        // Update winner stats
        PlayerStats storage winnerStats = playerStats[winner];
        winnerStats.gamesPlayed++;
        winnerStats.gamesWon++;
        if (winnerPayout > ESCROW_AMOUNT) {
            winnerStats.totalEarned += (winnerPayout - ESCROW_AMOUNT);
        }
        playerGameHistory[winner].push(gameId);
        
        // Update loser stats
        PlayerStats storage loserStats = playerStats[loser];
        loserStats.gamesPlayed++;
        loserStats.gamesLost++;
        if (loserPayout < ESCROW_AMOUNT) {
            loserStats.totalLost += (ESCROW_AMOUNT - loserPayout);
        }
        playerGameHistory[loser].push(gameId);
        
        // Reset balances before transfer
        game.player1Balance = 0;
        game.player2Balance = 0;
        
        // Transfer payouts
        if (player1Payout > 0) {
            require(
                cUSD.transfer(game.player1, player1Payout),
                "Player 1 payout failed"
            );
        }
        
        if (player2Payout > 0) {
            require(
                cUSD.transfer(game.player2, player2Payout),
                "Player 2 payout failed"
            );
        }
        
        emit GameEnded(gameId, winner, player1Payout, player2Payout);
        emit StatsUpdated(winner, winnerStats.gamesPlayed, winnerStats.gamesWon, winnerStats.gamesLost, winnerStats.totalEarned, winnerStats.totalLost);
        emit StatsUpdated(loser, loserStats.gamesPlayed, loserStats.gamesWon, loserStats.gamesLost, loserStats.totalEarned, loserStats.totalLost);
    }
    
    /**
     * @dev Claim victory by timeout when opponent doesn't move
     * Can be called after GAME_TIMEOUT has passed since last move
     *
     * @param gameId The game ID to claim timeout for
     *
     * Requirements:
     * - Game must be ACTIVE
     * - Caller must be a player in the game
     * - GAME_TIMEOUT must have passed since last move
     *
     * Effects:
     * - Declares caller as winner
     * - Updates player statistics for both players
     * - Adds game to both players' history
     * - Transfers final balances to players
     * - Emits GameTimedOut, GameEnded, and StatsUpdated events
     */
    function claimTimeout(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        require(game.status == GameStatus.ACTIVE, "Game not active");
        require(
            msg.sender == game.player1 || msg.sender == game.player2,
            "Not a player"
        );
        require(
            block.timestamp >= game.lastMoveAt + GAME_TIMEOUT,
            "Game not timed out"
        );
        
        address winner = msg.sender;
        address loser = winner == game.player1 ? game.player2 : game.player1;
        
        game.status = GameStatus.FINISHED;
        game.winner = winner;
        
        uint256 player1Payout = game.player1Balance;
        uint256 player2Payout = game.player2Balance;
        uint256 winnerPayout = winner == game.player1 ? player1Payout : player2Payout;
        uint256 loserPayout = winner == game.player1 ? player2Payout : player1Payout;
        
        // Update winner stats
        PlayerStats storage winnerStats = playerStats[winner];
        winnerStats.gamesPlayed++;
        winnerStats.gamesWon++;
        if (winnerPayout > ESCROW_AMOUNT) {
            winnerStats.totalEarned += (winnerPayout - ESCROW_AMOUNT);
        }
        playerGameHistory[winner].push(gameId);
        
        // Update loser stats
        PlayerStats storage loserStats = playerStats[loser];
        loserStats.gamesPlayed++;
        loserStats.gamesLost++;
        if (loserPayout < ESCROW_AMOUNT) {
            loserStats.totalLost += (ESCROW_AMOUNT - loserPayout);
        }
        playerGameHistory[loser].push(gameId);
        
        game.player1Balance = 0;
        game.player2Balance = 0;
        
        if (player1Payout > 0) {
            require(cUSD.transfer(game.player1, player1Payout), "Payout failed");
        }
        
        if (player2Payout > 0) {
            require(cUSD.transfer(game.player2, player2Payout), "Payout failed");
        }
        
        emit GameTimedOut(gameId, winner);
        emit GameEnded(gameId, winner, player1Payout, player2Payout);
        emit StatsUpdated(winner, winnerStats.gamesPlayed, winnerStats.gamesWon, winnerStats.gamesLost, winnerStats.totalEarned, winnerStats.totalLost);
        emit StatsUpdated(loser, loserStats.gamesPlayed, loserStats.gamesWon, loserStats.gamesLost, loserStats.totalEarned, loserStats.totalLost);
    }
    
    /**
     * @dev Cancel a waiting game (only creator can cancel)
     * Allows cancellation if no opponent joins within 5 minutes
     *
     * @param gameId The game ID to cancel
     *
     * Requirements:
     * - Game must be in WAITING status
     * - Caller must be the game creator
     * - At least 5 minutes must have passed since creation
     *
     * Effects:
     * - Changes status to CANCELLED
     * - Refunds escrow to creator
     * - Emits GameCancelled event
     */
    function cancelGame(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        require(game.status == GameStatus.WAITING, "Can only cancel waiting");
        require(game.player1 == msg.sender, "Only creator can cancel");
        require(
            block.timestamp >= game.createdAt + 5 minutes,
            "Wait 5 minutes"
        );
        
        game.status = GameStatus.CANCELLED;
        uint256 refund = game.player1Escrow;
        game.player1Escrow = 0;
        
        require(cUSD.transfer(game.player1, refund), "Refund failed");
        
        emit GameCancelled(gameId);
    }
    
    // ============ Utility Functions ============
    
    /**
     * @dev Get the monetary value of a chess piece
     * @param pieceType The type of chess piece
     * @return The cUSD value of the piece (18 decimals)
     */
    function getPieceValue(PieceType pieceType) public pure returns (uint256) {
        if (pieceType == PieceType.PAWN) return PAWN_VALUE;
        if (pieceType == PieceType.KNIGHT) return KNIGHT_VALUE;
        if (pieceType == PieceType.BISHOP) return BISHOP_VALUE;
        if (pieceType == PieceType.ROOK) return ROOK_VALUE;
        if (pieceType == PieceType.QUEEN) return QUEEN_VALUE;
        return 0;
    }
    
    /**
     * @dev Get comprehensive game information
     * @param gameId The game ID to query
     * @return player1 First player address
     * @return player2 Second player address
     * @return player1Balance Current balance of player1
     * @return player2Balance Current balance of player2
     * @return status Current game status
     * @return winner Winner address (zero if not finished)
     * @return createdAt Game creation timestamp
     * @return lastMoveAt Last move timestamp
     */
    function getGame(uint256 gameId) external view returns (
        address player1,
        address player2,
        uint256 player1Balance,
        uint256 player2Balance,
        GameStatus status,
        address winner,
        uint256 createdAt,
        uint256 lastMoveAt
    ) {
        Game storage game = games[gameId];
        return (
            game.player1,
            game.player2,
            game.player1Balance,
            game.player2Balance,
            game.status,
            game.winner,
            game.createdAt,
            game.lastMoveAt
        );
    }
    
    /**
     * @dev Check if a player is authorized for gasless gameplay
     * @param gameId The game ID to check
     * @param player The player address to check
     * @return True if player is authorized, false otherwise
     */
    function isAuthorized(uint256 gameId, address player)
        external
        view
        returns (bool)
    {
        return authorized[gameId][player];
    }
    
    /**
     * @dev Check if a capture has already been processed
     * Prevents duplicate capture processing
     * @param gameId The game ID to check
     * @param captureId The unique capture identifier
     * @return True if capture was processed, false otherwise
     */
    function isCaptureProcessed(uint256 gameId, bytes32 captureId)
        external
        view
        returns (bool)
    {
        return processedCaptures[gameId][captureId];
    }
    
    // ============ Player Statistics ============
    
    /**
     * @dev Get comprehensive player statistics
     * @param player The player address to query
     * @return gamesPlayed Total games participated in
     * @return gamesWon Total games won
     * @return gamesLost Total games lost
     * @return totalEarned Total cUSD earned from wins
     * @return totalLost Total cUSD lost from losses
     * @return winRate Win rate percentage (0-100)
     */
    function getPlayerStats(address player) external view returns (
        uint256 gamesPlayed,
        uint256 gamesWon,
        uint256 gamesLost,
        uint256 totalEarned,
        uint256 totalLost,
        uint256 winRate
    ) {
        PlayerStats memory stats = playerStats[player];
        uint256 rate = stats.gamesPlayed > 0 
            ? (stats.gamesWon * 100) / stats.gamesPlayed 
            : 0;
        
        return (
            stats.gamesPlayed,
            stats.gamesWon,
            stats.gamesLost,
            stats.totalEarned,
            stats.totalLost,
            rate
        );
    }
    
    /**
     * @dev Get paginated game history for a player
     * Returns newest games first (reverse chronological order)
     * @param player The player address to query
     * @param limit Maximum number of games to return
     * @param offset Number of games to skip (for pagination)
     * @return Array of game IDs
     */
    function getPlayerGameHistory(address player, uint256 limit, uint256 offset)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] storage allGames = playerGameHistory[player];
        uint256 totalGames = allGames.length;
        
        if (offset >= totalGames) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > totalGames) {
            end = totalGames;
        }
        
        uint256 resultLength = end - offset;
        uint256[] memory result = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = allGames[totalGames - 1 - offset - i]; // Reverse order (newest first)
        }
        
        return result;
    }
    
    /**
     * @dev Get total number of games played by a player
     * @param player The player address to query
     * @return Total number of games in player's history
     */
    function getPlayerGameCount(address player) external view returns (uint256) {
        return playerGameHistory[player].length;
    }
}