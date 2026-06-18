#!/bin/bash

# ============================================================
# RoomFlow — Quick Setup Script
# ============================================================
# This script prepares the environment for production.
# ============================================================

set -e

echo "🚀 Initializing RoomFlow Setup..."

# 1. Check for .env
if [ ! -f .env ]; then
  echo "📄 .env file not found. Creating from .env.example..."
  cp .env.example .env
  
  # Generate random secrets
  echo "🔑 Generating secure secrets..."
  JWT_SECRET=$(openssl rand -base64 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  
  # Update .env
  sed -i "s/JWT_SECRET=change...n/JWT_SECRET=$JWT_SECRET/" .env
  sed -i "s/POSTGRES_PASSWORD=change...n/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
  
  echo "✅ .env created with secure defaults."
  echo "⚠️  ACTION REQUIRED: Edit .env to set your domain and WAHA credentials."
else
  echo "✅ .env file exists. Skipping creation."
fi

# 2. Build Services
echo "🏗️  Building Docker containers (this may take a few minutes)..."
sudo docker compose build

# 3. Start Services
echo "🎬 Starting services..."
sudo docker compose up -d

# 4. Wait for Database
echo "⏳ Waiting for database to be ready (30s)..."
for i in {30..1}; do
    echo -ne "   $i \r"
    sleep 1
done

# 5. Database Initialization
echo "💾 Applying database migrations..."
sudo docker compose exec backend npx prisma migrate deploy

echo "🌱 Seeding initial data..."
sudo docker compose exec backend npx prisma db seed 2>/dev/null || echo "   (Seed skipped or already done)"

# 6. Final Status
echo ""
echo "============================================================"
echo "✅ RoomFlow SETUP COMPLETE!"
echo "============================================================"
echo "🌐 App running at: http://$(curl -s ifconfig.me)"
echo "📡 API running at: http://$(curl -s ifconfig.me)/api"
echo "============================================================"
echo "📊 SERVICE STATUS:"
sudo docker compose ps
echo "============================================================"
echo "💡 NEXT STEPS:"
echo "1. If using a custom domain, update NEXT_PUBLIC_API_URL in .env"
echo "2. If using WhatsApp, configure WAHA variables in .env"
echo "3. Restart services if you change .env: sudo docker compose up -d"
echo "============================================================"
