// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import "../src/MiniChessEscrowPaymaster.sol";

contract MiniChessEscrowTest is Test {
    MiniChessEscrowPaymaster public paymasterEscrow;

    
    // Use vm.addr to generate addresses from private keys
    address public owner = vm.addr(1);
    address public player1 = vm.addr(2);
    address public player2 = vm.addr(3);
    
    // Private keys for test accounts (for signing)
    uint256 private ownerPrivateKey = 1;
    uint256 private player1PrivateKey = 2;
    uint256 private player2PrivateKey = 3;
    
    uint256 public constant WAGER_AMOUNT = 2.5 ether;
    
    event GameCreated(uint256 indexed gameId, address indexed player1, uint256 wager);
    event GameJoined(uint256 indexed gameId, address indexed player2);
    event PieceCaptured(uint256 indexed gameId, address indexed capturer, uint256 reward);
    event GameCompleted(uint256 indexed gameId, address indexed winner, uint256 reward);
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy paymaster contract with mock EntryPoint address
        paymasterEscrow = new MiniChessEscrowPaymaster(address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789));
        
        vm.stopPrank();
    }
    
    function testCreateGame() public {
        vm.startPrank(player1);
        
        // Mint cUSD to player1 (mock)
        vm.deal(player1, 10 ether);
        
        // Create game with session
        bytes32 sessionMessageHash = keccak256(abi.encodePacked(
            "AUTHORIZE_SESSION", uint256(1), block.chainid
        ));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(sessionMessageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(player1PrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        paymasterEscrow.createGameWithSession(signature);
        
        // Verify game state
        (address p1, address p2, uint256 player1Balance, uint256 player2Balance, , , , ) = paymasterEscrow.getGame(1);
        assertEq(p1, player1);
        assertEq(p2, address(0));
        assertEq(player1Balance, 2.5 ether);
        assertEq(player2Balance, 0);
        
        vm.stopPrank();
    }
    
    function testJoinGame() public {
        // Setup: Create game
        vm.startPrank(player1);
        vm.deal(player1, 10 ether);
        
        bytes32 sessionMessageHash = keccak256(abi.encodePacked(
            "AUTHORIZE_SESSION", uint256(1), block.chainid
        ));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(sessionMessageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(player1PrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        paymasterEscrow.createGameWithSession(signature);
        vm.stopPrank();
        
        // Join game
        vm.startPrank(player2);
        vm.deal(player2, 10 ether);
        
        bytes32 joinSessionHash = keccak256(abi.encodePacked(
            "AUTHORIZE_SESSION", uint256(1), block.chainid
        ));
        bytes32 ethSignedJoinMessageHash = MessageHashUtils.toEthSignedMessageHash(joinSessionHash);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(player2PrivateKey, ethSignedJoinMessageHash);
        bytes memory joinSignature = abi.encodePacked(r2, s2, v2);
        
        paymasterEscrow.joinGameWithSession(1, joinSignature);
        
        // Verify game state
        (address p1, address p2, uint256 player1Balance, uint256 player2Balance, , , , ) = paymasterEscrow.getGame(1);
        assertEq(p1, player1);
        assertEq(p2, player2);
        assertEq(player1Balance, 2.5 ether);
        assertEq(player2Balance, 2.5 ether);
        
        vm.stopPrank();
    }
}