#!/bin/bash

# Custom Paymaster Deployment Script for MiniChess
# This script deploys the custom paymaster and sets up the bundler

set -e

echo "🚀 Starting Custom Paymaster Deployment for MiniChess"
echo "================================================"

# Check if required tools are installed
if ! command -v forge &> /dev/null; then
    echo "❌ Foundry is not installed. Please install it first."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it first."
    exit 1
fi

# Get environment variables
echo "📋 Checking environment variables..."

# Set private key
echo "ℹ️  Using provided private key"
export PRIVATE_KEY="0xad03c579052d5093c83d34224efb31a2d6ad3bc917d3c5c25a527a1ac7cc6904"

# Set default game contract address if not provided
if [ -z "$GAME_CONTRACT_ADDRESS" ]; then
    export GAME_CONTRACT_ADDRESS="0x2D44905Ca27E1d45fFCe14E69effa8A06BAb6996"
    echo "ℹ️  Using default MiniChess game contract address"
fi

echo "✅ Environment variables are set"
echo "📋 Game Contract: $GAME_CONTRACT_ADDRESS"

# Deploy paymaster contract
echo ""
echo "📜 Deploying Custom Paymaster Contract..."
echo "----------------------------------------"

cd apps/contracts

# Build contracts first
echo "🔨 Building contracts..."
forge build

# Deploy and capture output
echo "🚀 Deploying paymaster..."
DEPLOY_OUTPUT=$(forge script script/DeployCustomPaymaster.s.sol \
    --rpc-url https://rpc.ankr.com/celo_sepolia \
    --broadcast \
    --verify 2>&1)

echo "$DEPLOY_OUTPUT"

# Try to extract paymaster address from output
DEPLOYED_PAYMASTER=$(echo "$DEPLOY_OUTPUT" | grep -A 1 "MiniChessCustomPaymaster deployed to:" | tail -n 1 | xargs)

if [ ! -z "$DEPLOYED_PAYMASTER" ]; then
    echo ""
    echo "✅ Paymaster deployed at: $DEPLOYED_PAYMASTER"
    export PAYMASTER_ADDRESS=$DEPLOYED_PAYMASTER
else
    echo "⚠️  Could not auto-detect paymaster address from output"
    echo "Please check the deployment logs above and set PAYMASTER_ADDRESS manually"
fi

echo ""
echo "🔧 Setting up Bundler..."
echo "-------------------------"

cd ../../bundler

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing bundler dependencies..."
    npm install
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating bundler environment file..."
    cp .env.example .env
    
    echo "⚠️  Please update the following in bundler/.env:"
    echo "   - PAYMASTER_ADDRESS (after deployment)"
    echo "   - BENEFICIARY_ADDRESS"
    echo "   - PRIVATE_KEY"
    echo ""
    echo "   Then run this script again with: ./deploy-custom-paymaster.sh"
    exit 0
fi

# Update .env with deployed paymaster address if we have it
if [ ! -z "$DEPLOYED_PAYMASTER" ]; then
    echo "📝 Updating bundler .env with deployed address..."
    sed -i "s/PAYMASTER_ADDRESS=.*/PAYMASTER_ADDRESS=$DEPLOYED_PAYMASTER/" .env
else
    # Use provided paymaster address
    echo "📝 Using provided paymaster address..."
    sed -i "s/PAYMASTER_ADDRESS=.*/PAYMASTER_ADDRESS=0x70ce509337494fbbcbc337cc1d71294d000ae82a/" .env
fi

# Get paymaster address from environment or .env
if [ -z "$PAYMASTER_ADDRESS" ]; then
    # Try to read from .env file
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | grep PAYMASTER_ADDRESS | xargs)
    fi
fi

# Fund paymaster (if address is set)
if [ ! -z "$PAYMASTER_ADDRESS" ] && [ "$PAYMASTER_ADDRESS" != "YOUR_PAYMASTER_ADDRESS_HERE" ]; then
    echo "💰 Funding Paymaster Contract..."
    echo "---------------------------------"
    
    # Fund with 0.1 CELO
    cast send $PAYMASTER_ADDRESS \
        --value 0.1ether \
        --private-key $PRIVATE_KEY \
        --rpc-url https://rpc.ankr.com/celo_sepolia
    
    echo "✅ Paymaster funded with 0.1 CELO"
    
    # Add deposit to EntryPoint (convert 0.1 ether to wei)
    echo "🏦 Adding deposit to EntryPoint..."
    cast send $PAYMASTER_ADDRESS \
        "addEntryPointDeposit()" \
        --value 0.1ether \
        --private-key $PRIVATE_KEY \
        --rpc-url https://rpc.ankr.com/celo_sepolia
    
    echo "✅ 0.1 CELO deposited to EntryPoint"
    
    # Start bundler
    echo ""
    echo "🚀 Starting Bundler Service..."
    echo "-----------------------------"
    npm start
else
    echo "⚠️  PAYMASTER_ADDRESS not set. Please update bundler/.env and run again."
fi

echo ""
echo "🎉 Custom Paymaster Deployment Complete!"
echo "===================================="
echo ""
echo "Next steps:"
echo "1. Update frontend .env.local with:"
echo "   NEXT_PUBLIC_PAYMASTER_ADDRESS=$PAYMASTER_ADDRESS"
echo "   NEXT_PUBLIC_BUNDLER_URL=http://localhost:3000"
echo ""
echo "2. Start the frontend:"
echo "   cd ../apps/web && npm run dev"
echo ""
echo "3. Test the paymaster integration!"