#!/bin/bash

# Development Setup Script
# Sets up the Next.js frontend for local development

set -e

echo "🚀 Setting up Rappit Frontend"
echo "=============================="
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ required. You have: $(node -v)"
  exit 1
else
  echo "✅ Node.js version: $(node -v)"
fi

echo ""

# Install dependencies
echo "📥 Installing dependencies..."
npm install

echo ""

# Create .env.local if not exists
if [ ! -f .env.local ]; then
  echo "📝 Creating .env.local from template..."
  cp .env.local.example .env.local
  echo "✅ Created .env.local"
  echo ""
  echo "⚠️  Please edit .env.local and set BACKEND_URL"
  echo ""
else
  echo "✅ .env.local already exists"
  echo ""
fi

# Display configuration
echo "📋 Configuration:"
echo "----------------"
if [ -f .env.local ]; then
  cat .env.local | grep -v "^#" | grep -v "^$"
fi

echo ""
echo ""

# Check if backend is running
echo "🔍 Checking backend connection..."
BACKEND_URL=$(grep BACKEND_URL .env.local | cut -d'=' -f2)

if [ -z "$BACKEND_URL" ]; then
  echo "⚠️  BACKEND_URL not set in .env.local"
else
  echo "Backend URL: $BACKEND_URL"
  
  if curl -s -f -o /dev/null "$BACKEND_URL/health" 2>/dev/null; then
    echo "✅ Backend is reachable"
  else
    echo "⚠️  Backend not reachable at $BACKEND_URL"
    echo "   Make sure backend is running first!"
  fi
fi

echo ""
echo ""

# Display next steps
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "-------------"
echo "1. Edit .env.local and set BACKEND_URL (if not already set)"
echo "2. Make sure backend is running: cd ../backend && npm run start:dev"
echo "3. Start frontend: npm run dev"
echo "4. Open browser: http://localhost:3000"
echo ""
echo "🧪 To run tests:"
echo "   npm test"
echo ""
echo "🔧 To test auth flow:"
echo "   chmod +x scripts/test-auth-flow.sh"
echo "   ./scripts/test-auth-flow.sh"
echo ""

# Make test scripts executable
chmod +x scripts/test-auth-flow.sh 2>/dev/null || true

echo "🎉 Happy coding!"
