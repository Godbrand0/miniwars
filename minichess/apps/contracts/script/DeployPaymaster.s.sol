// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MiniChessEscrowPaymaster.sol";

contract DeployPaymasterScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address entryPointAddress = vm.envAddress("ENTRYPOINT_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        MiniChessEscrowPaymaster escrow = new MiniChessEscrowPaymaster(entryPointAddress);
        
        vm.stopBroadcast();
        
        console.log("MiniChessEscrowPaymaster deployed to:");
        console.log(address(escrow));
        console.log("EntryPoint address:");
        console.log(entryPointAddress);
    }
}