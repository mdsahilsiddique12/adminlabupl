#!/bin/bash

# Admin License Portal Deployment Script
# For Neon PostgreSQL + Render Docker + Netlify

echo "🚀 Admin License Portal Deployment"
echo "=================================="

# Check if required tools are installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is required but not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Node.js/npm is required but not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Build frontend
echo "📦 Building frontend..."
cd client
npm run build
cd ..

echo "✅ Frontend build complete"

# Check for environment files
if [ ! -f ".env.example" ]; then
    echo "❌ .env.example not found"
    exit 1
fi

if [ ! -f "client/.env.example" ]; then
    echo "❌ client/.env.example not found"
    exit 1
fi

echo "✅ Environment files found"

# Check Dockerfile
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found"
    exit 1
fi

echo "✅ Dockerfile found"

echo ""
echo "🎉 Ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Set up Neon PostgreSQL database"
echo "2. Configure environment variables in Render"
echo "3. Deploy backend to Render using Docker"
echo "4. Deploy frontend to Netlify"
echo "5. Run database migrations: npx prisma migrate deploy"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"