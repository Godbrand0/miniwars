#!/bin/bash

# MiniChess Contract Deployment Script
# This script deploys MiniChess contracts and generates ABIs for the frontend
# Paymaster + Session Keys only (no standard mode, no relayer)

set -e

echo "🚀 Starting MiniChess Contract Deployment..."

# Check if we're in the right directory
if [ ! -f "foundry.toml" ]; then
    echo "❌ Error: foundry.toml not found. Please run this script from the contracts directory."
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    source .env
    echo "✅ Environment variables loaded"
else
    echo "❌ Error: .env file not found. Please create it from .env.example"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "lib" ]; then
    echo "📦 Installing Foundry dependencies..."
    forge install
fi

# Run tests
echo "🧪 Running tests..."
forge test --gas-report

# Build contracts
echo "🔨 Building contracts..."
forge build

# Deploy to Celo Sepolia (testnet)
if [ "$NETWORK" = "celo-sepolia" ] || [ -z "$NETWORK" ]; then
    echo "🌐 Deploying to Celo Sepolia testnet..."
    
    # Deploy paymaster escrow
    echo "  💳 Deploying MiniChessEscrowPaymaster..."
    PAYMASTER_ADDRESS=$(forge script script/DeployPaymaster.s.sol --rpc-url $CELO_SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast --verify | grep "MiniChessEscrowPaymaster deployed at:" | awk '{print $4}')
    
    echo "✅ Celo Sepolia deployment complete!"
fi

# Deploy to Mainnet
if [ "$NETWORK" = "mainnet" ]; then
    echo "🌐 Deploying to Celo mainnet..."
    
    # Deploy paymaster escrow
    echo "  💳 Deploying MiniChessEscrowPaymaster..."
    PAYMASTER_ADDRESS=$(forge script script/DeployPaymaster.s.sol --rpc-url $CELO_MAINNET_RPC_URL --private-key $PRIVATE_KEY --broadcast --verify | grep "MiniChessEscrowPaymaster deployed at:" | awk '{print $4}')
    
    echo "✅ Mainnet deployment complete!"
fi

# Generate ABIs for frontend
echo "📋 Generating ABIs for frontend..."

# Create frontend contracts directory if it doesn't exist
mkdir -p ../web/src/contracts

# Copy ABIs
cp out/MiniChessEscrowPaymaster.sol/MiniChessEscrowPaymaster.json ../web/src/contracts/

# Create deployment info file
cat > ../web/src/contracts/deployments.json << EOF
{
  "celo-sepolia": {
    "MiniChessEscrowPaymaster": "$PAYMASTER_ADDRESS"
  },
  "mainnet": {
    "MiniChessEscrowPaymaster": "$PAYMASTER_ADDRESS"
  }
}
EOF

echo "✅ ABIs generated and copied to frontend"

# Update frontend environment variables
echo "🔧 Updating frontend environment variables..."

cat > ../web/.env.local << EOF
# MiniChess Contract Addresses
NEXT_PUBLIC_CONTRACT_ADDRESS=$PAYMASTER_ADDRESS

# Network Configuration
NEXT_PUBLIC_NETWORK_ID=${NETWORK:-celo-sepolia}
NEXT_PUBLIC_RPC_URL=${CELO_SEPOLIA_RPC_URL:-$CELO_MAINNET_RPC_URL}

# Pimlico Configuration
NEXT_PUBLIC_PIMLICO_API_KEY=$PIMLICO_API_KEY
NEXT_PUBLIC_PIMLICO_SPONSORSHIP_POLICY_ID=$PIMLICO_SPONSORSHIP_POLICY_ID
EOF

echo "✅ Frontend environment variables updated"

# Summary
echo ""
echo "🎉 Deployment Summary:"
echo "======================="
echo "Network: ${NETWORK:-celo-sepolia}"
echo "MiniChessEscrowPaymaster: $PAYMASTER_ADDRESS"
echo ""
echo "📱 Frontend updated with new contract addresses"
echo "🔗 ABIs available in ../web/src/contracts/"
echo ""
echo "🚀 You can now start the frontend with: cd ../web && npm run dev"