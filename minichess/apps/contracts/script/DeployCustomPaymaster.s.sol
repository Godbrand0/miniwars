// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MiniChessCustomPaymaster.sol";
import "../src/MiniChessEscrowPaymaster.sol";

contract DeployCustomPaymasterScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Celo Sepolia EntryPoint address
        address entryPointAddress = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
        
        // We'll use the existing MiniChessEscrowPaymaster as the target
        // This should be replaced with your actual game contract address after deployment
        address gameContractAddress = vm.envAddress("GAME_CONTRACT_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the custom paymaster
        MiniChessCustomPaymaster paymaster = new MiniChessCustomPaymaster(
            IEntryPoint(entryPointAddress),
            gameContractAddress
        );
        
        vm.stopBroadcast();
        
        console.log("MiniChessCustomPaymaster deployed to:");
        console.log(address(paymaster));
        console.log("EntryPoint address:");
        console.log(entryPointAddress);
        console.log("Game contract address:");
        console.log(gameContractAddress);
        
        // Instructions for funding
        console.log("\nNext steps:");
        console.log("1. Fund the paymaster with CELO");
        console.log("2. Add deposit to EntryPoint");
    }
}