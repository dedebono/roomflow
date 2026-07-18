# ============================================================
# RoomFlow — Production Deployment Guide
# ============================================================
# Tested on: Ubuntu 22.04+ / Debian 12+ | 2GB+ RAM | 20GB+ disk
# Requirements: Docker 24+, Docker Compose v2+
# ============================================================

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Quick Start](#quick-start)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Configuration Reference](#configuration-reference)
5. [Custom Domain & HTTPS](#custom-domain--https)
6. [Database Management](#database-management)
7. [Troubleshooting](#troubleshooting)
8. [Updating](#updating)
9. [Project Structure](#project-structure)

---

## System Requirements

### Minimum
- **OS**: Ubuntu 22.04+ / Debian 12+ / macOS 13+
- **RAM**: 2 GB
- **Disk**: 20 GB
- **Docker**: 24.x or newer
- **Docker Compose**: v2.x (standalone or plugin)

### Recommended
- **RAM**: 4 GB
- **CPU**: 2 cores
- **Disk**: 40 GB SSD
- **Domain**: Registered domain with DNS access

### Check Your Versions
```bash
docker --version           # Docker version 24.x or newer
docker compose version     # Docker Compose version v2.x
```

Install Docker if needed:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## Quick Start

### 1. Clone & Configure
```bash
# Clone the repository
git clone https://github.com/dedebono/roomflow.git
cd roomflow

# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env
```

### 2. Start Services
```bash
# Start all services (first run downloads images + builds)
sudo docker compose up -d

# Wait for database to be ready (~15 seconds)
sleep 20
```

### 3. Apply Database Migrations
```bash
# Run database migrations + seed data
sudo docker compose exec backend npx prisma migrate deploy
sudo docker compose exec backend npx prisma db seed 2>/dev/null || echo "Seed skipped"
```

### 4. Verify
```bash
# Check service status
sudo docker compose ps

# Visit the app
curl -s http://localhost | head -5

# View logs
sudo docker compose logs --tail=20
```

**App running at:** `http://YOUR_SERVER_IP`

---

## Step-by-Step Setup

### Step 1: Install Docker & Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y curl git ca-certificates

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add user to docker group (avoid sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### Step 2: Configure Environment

```bash
cd roomflow

# Copy the example env file
cp .env.example .env

# Required edits in .env:
nano .env
```

**Minimum required changes:**
```env
POSTGRES_PASSWORD=your_secure_password_here
JWT_SECRET=openssl_rand_-base64_32_output_here
```

**Optional (for WhatsApp integration):**
```env
WAHA_API_URL=http://your_waha_server:3000
WAHA_API_KEY=your_waha_api_key
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

### Step 3: Build & Start

```bash
# Build all services (first run only — takes 3-5 minutes)
sudo docker compose build

# Start in background
sudo docker compose up -d

# Check status
sudo docker compose ps
```

Expected output:
```
NAME                STATUS
roomflow-postgres   Up (healthy)
roomflow-backend   Up
roomflow-frontend  Up
roomflow-nginx     Up
```

### Step 4: Initialize Database

```bash
# Run migrations
sudo docker compose exec backend npx prisma migrate deploy

# Seed test data
sudo docker compose exec backend npx prisma db seed 2>/dev/null || true
```

### Step 5: Access the Application

```
Frontend:  http://YOUR_SERVER_IP
API:       http://YOUR_SERVER_IP/api
```

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | ✅ Yes | `roomflow` | PostgreSQL password |
| `JWT_SECRET` | ✅ Yes | — | JWT signing secret (min 32 chars) |
| `NEXT_PUBLIC_API_URL` | ✅ Yes | `/api` | Frontend API URL (must match domain) |
| `WAHA_ENABLED` | No | `false` | Enable WhatsApp integration |
| `WAHA_API_URL` | If WAHA enabled | — | WAHA server URL |
| `WAHA_API_KEY` | If WAHA enabled | — | WAHA API key |
| `STORAGE_TYPE` | No | `LOCAL` | Storage backend (LOCAL/S3) |
| `EMAIL_ENABLED` | No | `false` | Enable email notifications (Resend) |
| `EMAIL_API_KEY` | If email enabled | — | Resend API key |
| `EMAIL_FROM` | If email enabled | `noreply@glorios.uk` | From address |
| `PAKASIR_SLUG` | No | — | Pakasir merchant slug (venueone) |
| `PAKASIR_API_KEY` | If Pakasir used | — | Pakasir API key |

### Generate Secure Secrets

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate PostgreSQL password
openssl rand -hex 16
```

### Ports

| Service | Port | Description |
|---------|------|-------------|
| Nginx | 80 | HTTP (frontend + API) |
| Backend | 3000 | REST API only |
| Frontend | 3000 | Direct frontend access |
| PostgreSQL | 5432 | Database (localhost only) |

Nginx routing: `/api` → backend:3000, `/uploads/` → backend:3000, `/` → frontend:3000.

---

## Custom Domain & HTTPS

### Option 1: Cloudflare Tunnel (Recommended — Free)

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Create tunnel
cloudflared tunnel create roomflow

# Get tunnel ID
cloudflared tunnel list

# Route domain
cloudflared tunnel route dns <TUNNEL_ID> room.ytcb.org

# Update nginx.conf server_name to match your domain
nano nginx.conf
# Change: server_name room.ytcb.org;
# To:     server_name your.domain.com;

# Restart nginx
sudo docker compose restart nginx
```

### Option 2: Let's Encrypt HTTPS (Self-Hosted)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Stop nginx briefly
sudo docker compose stop nginx

# Get certificate
sudo certbot --nginx -d your-domain.com --non-interactive --agree-tos -m admin@your-domain.com

# Enable HTTPS in nginx.conf (add after getting certs)
# Then restart
sudo docker compose start nginx
```

### Option 3: Reverse Proxy (Nginx/Caddy on Host)

If running RoomFlow behind a reverse proxy on the host machine,
change nginx to expose a different port:

```bash
# In docker-compose.yml, change nginx ports:
nginx:
  ports:
    - '8080:80'   # Instead of 80:80
```

Then configure your reverse proxy to forward HTTPS traffic.

---

## Database Management

### Connect to PostgreSQL
```bash
# Interactive psql
sudo docker compose exec postgres psql -U roomflow -d roomflow

# Run SQL directly
sudo docker compose exec postgres psql -U roomflow -d roomflow -c "SELECT COUNT(*) FROM \"Room\";"
```

### Create Migrations
```bash
# Development (creates migration files)
sudo docker compose exec backend npx prisma migrate dev --name add_feature

# Production (applies migrations only)
sudo docker compose exec backend npx prisma migrate deploy
```

### Reset Database
```bash
# WARNING: Destroys all data
sudo docker compose exec backend npx prisma migrate reset --force
```

### Backup Database
```bash
# Backup to file
sudo docker compose exec postgres pg_dump -U roomflow roomflow > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
cat backup_file.sql | sudo docker compose exec -T postgres psql -U roomflow -d roomflow
```

### View/Edit Data via Prisma Studio
```bash
sudo docker compose exec backend npx prisma studio
# Opens at http://localhost:3000 (mapped from backend container port 5555 in compose)
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
sudo docker compose logs

# Check specific service
sudo docker compose logs backend
sudo docker compose logs postgres
sudo docker compose logs nginx

# Restart all
sudo docker compose restart
```

### Database Connection Error

```bash
# Wait longer (first start can take 30s)
sleep 30

# Check postgres is healthy
sudo docker compose ps postgres

# Check DATABASE_URL in backend
sudo docker compose exec backend env | grep DATABASE
```

### Frontend Build Fails

```bash
# Clean build (no cache)
sudo docker compose build --no-cache frontend
sudo docker compose up -d frontend
```

### 502 Bad Gateway

```bash
# Check if nginx.conf is mounted correctly
cat nginx.conf | grep proxy_pass

# Verify containers are on same network
sudo docker network inspect roomflow_default

# Restart nginx
sudo docker compose restart nginx
```

### Prisma Migration Error

```bash
# Force reset (WARNING: deletes data)
sudo docker compose exec backend npx prisma migrate reset --force

# Or run migrate deploy
sudo docker compose exec backend npx prisma migrate deploy
```

### WhatsApp Not Working

```bash
# Check WAHA status
sudo docker compose logs backend | grep -i waha

# Verify WAHA credentials in .env
cat .env | grep WAHA

# Test WAHA connection manually
curl -X GET "${WAHA_API_URL}/api/sessions" \
  -H "x-api-key: ${WAHA_API_KEY}"
```

### Reset Everything (Fresh Start)

```bash
# Stop all
sudo docker compose down

# Remove volumes (deletes ALL data)
sudo docker compose down -v

# Remove built images (rebuild from scratch)
sudo docker image prune -a

# Start fresh
sudo docker compose up -d
```

---

## Updating

### Pull Latest Code
```bash
git pull origin main
```

### Rebuild & Restart
```bash
sudo docker compose build --no-cache
sudo docker compose up -d
```

### Run Migrations
```bash
sudo docker compose exec backend npx prisma migrate deploy
```

---

## Project Structure

```
roomflow/
├── backend/                    # NestJS API server
│   ├── src/
│   │   ├── auth/              # JWT authentication
│   │   ├── rooms/             # Room CRUD + categories
│   │   ├── bookings/          # Booking management
│   │   ├── rentals/           # Hourly rental slots + holds
│   │   ├── payments/          # Payment upload + approval
│   │   ├── pakasir/           # Pakasir payment gateway (venueone)
│   │   ├── email/             # Email notifications (Resend)
│   │   ├── email-config/      # Runtime email config (Admin IT UI)
│   │   ├── chat/              # Real-time messaging
│   │   ├── notifications/     # In-app alerts
│   │   ├── storage/           # File upload + image compression
│   │   ├── whatsapp/          # WhatsApp integration (WAHA)
│   │   └── common/            # Guards, decorators, pipes
│   ├── prisma/
│   │   └── schema.prisma       # Database schema + relations
│   └── Dockerfile
├── frontend/                   # Next.js 16 app
│   ├── src/app/
│   │   ├── renter/            # Renter-facing pages
│   │   ├── dashboard/         # Manager/Admin pages
│   │   ├── admin/              # System administration
│   │   └── (auth)/            # Login, register
│   ├── src/components/
│   │   ├── landing/           # Public landing page
│   │   └── ui/                # Shared UI components
│   └── Dockerfile
├── scripts/
│   ├── setup.sh               # First-time setup script
│   └── migrate.sh             # Migration runner
├── docker-compose.yml          # Service orchestration
├── nginx.conf                  # Reverse proxy + routing
├── .env.example               # Environment template
├── .env                       # Your secrets (not in git)
├── .gitignore                 # Ignored files
└── README.md                  # This file
```

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| IT Admin | admin@roomflow.local | password123 |
| Room Manager | manager@roomflow.local | password123 |
| Renter | jack@mail.com | password123 |

---

## Support

```bash
# View all logs
sudo docker compose logs -f

# View specific service
sudo docker compose logs -f backend

# Service health
sudo docker compose ps

# Resource usage
sudo docker stats --no-stream
```

---

**Last Updated**: 2026-07-18 | **Version**: 10+ | **License**: MIT