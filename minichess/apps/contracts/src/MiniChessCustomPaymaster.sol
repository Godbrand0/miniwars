// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title MiniChessCustomPaymaster
 * @dev Self-hosted paymaster that sponsors gas for MiniChess game operations
 * 
 * This paymaster:
 * - Sponsors gas transactions for MiniChess game operations
 * - Validates that operations are only for the MiniChess game contract
 * - Implements rate limiting and cost controls
 * - Allows owner to configure policies and withdraw funds
 */
contract MiniChessCustomPaymaster is BasePaymaster {
    // ============ Constants ============
    
    /// @dev CELO token address on Celo Sepolia testnet
    address public constant CELO_TOKEN = 0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9;
    
    /// @dev Maximum gas cost per operation (in wei)
    uint256 public constant MAX_COST_PER_OPERATION = 0.01 ether;
    
    /// @dev Rate limit window (1 hour)
    uint256 public constant RATE_LIMIT_WINDOW = 1 hours;
    
    /// @dev Maximum operations per window per user
    uint256 public constant MAX_OPS_PER_WINDOW = 50;
    
    // ============ State Variables ============
    
    /// @dev ERC20 token interface for CELO
    IERC20 public immutable celoToken;
    
    /// @dev Only allow calls to MiniChess game contract
    address public allowedTarget;
    
    /// @dev Maximum gas cost per operation (configurable by owner)
    uint256 public maxCostPerOperation;
    
    /// @dev Rate limiting: user -> (count, resetTime)
    mapping(address => uint256) public userOpCount;
    mapping(address => uint256) public userOpResetTime;
    
    /// @dev Paymaster deposit in EntryPoint
    uint256 public paymasterDeposit;
    
    // ============ Events ============
    
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event TargetUpdated(address indexed newTarget);
    event MaxCostUpdated(uint256 newMaxCost);
    event OperationSponsored(address indexed user, uint256 gasCost);
    event EntryPointDepositAdded(uint256 amount);
    event EntryPointDepositWithdrawn(uint256 amount);
    
    // ============ Constructor ============
    
    constructor(
        IEntryPoint _entryPoint,
        address _allowedTarget
    ) BasePaymaster(_entryPoint, msg.sender) {
        allowedTarget = _allowedTarget;
        celoToken = IERC20(CELO_TOKEN);
        maxCostPerOperation = MAX_COST_PER_OPERATION;
    }
    
    // ============ EntryPoint Validation Override ============
    
    /**
     * @dev Override to skip EntryPoint interface validation
     * Celo Sepolia's EntryPoint doesn't support supportsInterface
     */
    function _validateEntryPointInterface(IEntryPoint) internal view virtual override {
        // Skip validation - trust the provided EntryPoint address
    }
    
    // ============ Paymaster Functions ============
    
    /**
     * @dev Validate and pay for the user operation
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param maxCost The maximum cost of this operation
     * @return context Empty context for this simple paymaster
     * @return validationData Validation result (0 for success)
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        // Note: We validate that operations are for the MiniChess contract by checking callData
        // The userOp.sender is the smart account address, not the target contract
        
        // Decode the callData to get the target address
        // CallData format: execute(address target, uint256 value, bytes data)
        if (userOp.callData.length >= 68) {
            address target;
            // Extract target address from callData (skip 4 byte selector, then read address)
            bytes calldata callDataBytes = userOp.callData;
            assembly {
                target := shr(96, calldataload(add(callDataBytes.offset, 4)))
            }
            require(target == allowedTarget, "Invalid target contract");
        }
        
        // Check rate limiting (use sender as the user identifier)
        _checkRateLimit(userOp.sender);
        
        // Check if the paymaster has enough balance
        require(address(this).balance >= maxCost, "Insufficient paymaster balance");
        
        // Return empty context and validation success (0)
        return ("", 0);
    }
    
    /**
     * @dev Post-operation hook (called after the user operation is executed)
     * @param mode The post-operation mode
     * @param context The context from validation
     * @param actualGasCost The actual gas cost
     * @param actualUserOpGasPrice The actual gas price used
     */
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpGasPrice
    ) internal override {
        // Ensure we don't exceed the maximum cost per operation
        require(actualGasCost <= maxCostPerOperation, "Gas cost too high");
        
        // Emit event for monitoring
        emit OperationSponsored(tx.origin, actualGasCost);
    }
    
    // ============ Rate Limiting ============
    
    /**
     * @dev Check if user is within rate limits
     * @param user The user address to check
     */
    function _checkRateLimit(address user) internal {
        uint256 resetTime = userOpResetTime[user];
        uint256 count = userOpCount[user];
        
        // Reset counter if window has passed
        if (block.timestamp >= resetTime) {
            userOpCount[user] = 1;
            userOpResetTime[user] = block.timestamp + RATE_LIMIT_WINDOW;
        } else {
            require(count < MAX_OPS_PER_WINDOW, "Rate limit exceeded");
            userOpCount[user] = count + 1;
        }
    }
    
    // ============ Owner Functions ============
    
    /**
     * @dev Add funds to the paymaster (overrides BasePaymaster.deposit)
     * Note: BasePaymaster.deposit() is not virtual, so we can't override it
     * Use the inherited deposit() function from BasePaymaster instead
     */
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw funds from the paymaster (only owner)
     * @param amount The amount to withdraw
     */
    function withdraw(uint256 amount) public onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        
        payable(owner()).transfer(amount);
        emit Withdrawn(owner(), amount);
    }
    
    /**
     * @dev Update the allowed target contract (only owner)
     * @param newTarget The new target contract address
     */
    function updateAllowedTarget(address newTarget) public onlyOwner {
        allowedTarget = newTarget;
        emit TargetUpdated(newTarget);
    }
    
    /**
     * @dev Update maximum cost per operation (only owner)
     * @param newMaxCost The new maximum cost
     */
    function updateMaxCost(uint256 newMaxCost) public onlyOwner {
        require(newMaxCost <= MAX_COST_PER_OPERATION, "Cost too high");
        maxCostPerOperation = newMaxCost;
        emit MaxCostUpdated(newMaxCost);
    }
    
    /**
     * @dev Add deposit to EntryPoint (only owner)
     * Uses the inherited deposit() function from BasePaymaster
     */
    function addEntryPointDeposit() public payable onlyOwner {
        deposit();
        paymasterDeposit += msg.value;
        emit EntryPointDepositAdded(msg.value);
    }
    
    /**
     * @dev Withdraw from EntryPoint deposit (only owner)
     * Uses the inherited withdrawTo function from BasePaymaster
     * @param target The target address to receive funds
     * @param amount The amount to withdraw
     */
    function withdrawEntryPointDeposit(address payable target, uint256 amount) public onlyOwner {
        require(paymasterDeposit >= amount, "Insufficient deposit");
        
        withdrawTo(target, amount);
        paymasterDeposit -= amount;
        emit EntryPointDepositWithdrawn(amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get paymaster balance
     */
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Get paymaster deposit in EntryPoint
     * Uses the inherited getDeposit() function from BasePaymaster
     */
    function getPaymasterDeposit() public view returns (uint256) {
        return getDeposit();
    }
    
    /**
     * @dev Get user's remaining operations in current window
     * @param user The user address to check
     * @return remaining The number of remaining operations
     * @return resetTime The time when the window resets
     */
    function getUserRateLimit(address user) public view returns (uint256 remaining, uint256 resetTime) {
        uint256 count = userOpCount[user];
        uint256 reset = userOpResetTime[user];
        
        if (block.timestamp >= reset) {
            return (MAX_OPS_PER_WINDOW, 0);
        } else {
            return (MAX_OPS_PER_WINDOW - count, reset);
        }
    }
    
    /**
     * @dev Get paymaster configuration
     */
    function getConfiguration() public view returns (
        address _allowedTarget,
        uint256 _maxCostPerOperation,
        uint256 _balance,
        uint256 _deposit
    ) {
        return (
            allowedTarget,
            maxCostPerOperation,
            address(this).balance,
            getDeposit()
        );
    }
}