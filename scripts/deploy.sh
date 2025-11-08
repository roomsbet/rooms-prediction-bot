#!/bin/bash

# ROOMS Bot Deployment Script
# Trusted by Helius • Powered by Turnkey

set -e

echo "🚀 Deploying ROOMS Prediction Market Bot..."

# Check environment
if [ -z "$TG_BOT_TOKEN" ]; then
    echo "❌ Error: TG_BOT_TOKEN not set"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Start bot
echo "✅ Starting bot..."
npm start

