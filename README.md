# ============================================================
# RoomFlow — Production Deployment Guide
# ============================================================
# Tested on: Ubuntu 22.04+ / Debian 12+ | 2GB+ RAM | 20GB+ disk
# Requirements: Docker 24+, Docker Compose v2+
# ============================================================

## Table of Contents

1. [What's New (2026-10-16)](#whats-new-2026-10-16)
2. [System Requirements](#system-requirements)
3. [Quick Start](#quick-start)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [Configuration Reference](#configuration-reference)
6. [API Reference — All Endpoints](#api-reference--all-endpoints)
7. [Database Schema](#database-schema)
8. [Realtime & WebSocket](#realtime--websocket)
9. [Custom Domain & HTTPS](#custom-domain--https)
10. [Database Management](#database-management)
11. [Troubleshooting](#troubleshooting)
12. [Updating](#updating)
13. [Project Structure](#project-structure)

---

## What's New (2026-10-16)

> Syncs README with the live codebase on `main` (commit `1f7fa45` + uncommitted worktree). Run `git pull && docker compose up -d --build` to apply.

### New / Updated Features
- **WAHA WhatsApp stack** — `docker-compose.yml` now runs `devlikeapro/waha:latest` as `roomflow-waha` on `3002:3000` with volume `waha_sessions`. Runtime config via `/api/waha-config` (Admin IT UI). `WAHA_ENABLED=true` by default.
- **Email Config runtime** — `EmailConfig` table + `/api/email-config` (GET/PUT/POST test) lets Admin IT switch SMTP without redeploy. `EMAIL_ENABLED`/`EMAIL_FROM` remain env defaults.
- **Notifications delete** — `DELETE /api/notifications/:id` added (`NotificationsService.remove`). Dismiss single notifications.
- **Format helpers hardened** — `frontend/src/lib/format.ts`: `formatDate/formatTime/formatDateTime` now handle `undefined`/short strings (`"-"` / `"--:--"` fallback). `formatRupiah` stays `Rp` (id-ID).
- **Booking/Calendar UX** — `RoomCalendar` timezone + availability rendering, rental price in `RoomCategory` (EVENT/SPORT), hold expiry now from `now` not rental date, `TimeSlotSelector` + `BookingSummary` polish, dark mode toggle + landing revamp.
- **Currency** — All displays moved from `$` to `Rp` (IDR), schedule time formatting fixed.

### Infra / Routing Changes (review before deploy)
- **Backend `main.ts`** — CORS now `origin: true` (allow all) + `app.listen(port, '0.0.0.0')`. Previous allow-list removed. `ALLOWED_ORIGINS` env still parsed but not enforced. Lock down `origin` before public exposure.
- **Nginx `nginx.conf`** — `/api/` now `proxy_pass http://backend:3000/` (was `.../api/`), `/` now `proxy_pass http://frontend:3000` (no trailing slash). `/socket.io/` keeps upgrade headers with `Connection: Upgrade`. Baked into image via `.github/deploy/nginx.Dockerfile`.
- **Frontend `next.config.ts`** — `images.remotePatterns` + `reactStrictMode:false` removed. Added `rewrites()` → `source: /api/:path* → destination: http://100.127.221.23:3001/api/:path*`. **Fix needed**: hard-codes Tailscale IP and wrong port (backend is 3000, not 3001). In Docker/nginx setup nginx bypasses it; for local dev point to `http://backend:3000/api/:path*` or `http://localhost:3000/api/:path*`.
- **Docker Compose** — `postgres_data` now `external: true, name: roomflow_postgres_data`, `waha_sessions` added, `backend` mounts `./backend/src:/app/src` (dev live-reload; remove for production), `frontend` args `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_BASE_URL` baked at build.
- **Deps** — `@types/express` 5.0.0→5.0.6, `@types/multer` 2.1.0→2.2.0, `@types/node` 24.0.0→24.13.3; `express` kept ^4.21.2.
- **Other** — Pakasir redirect via `FRONTEND_BASE_URL`, `DELETE /rentals/holds/:id` added, `getRoomAvailability` sends `Cache-Control: no-cache`.

> Operator action: set `WAHA_API_URL/WAHA_API_KEY/WAHA_SESSION` and `FRONTEND_BASE_URL` if using Pakasir.

### Also in origin/main since last pull
- **Batch multi-slot payments** — `POST /rentals/create-holds` + `POST /payments/initiate-batch` + `BookingBag` + `BookingSummary` cart (multiple slots → multiple holds → one batch payment). `approve()` now marks ALL bookings BOOKED, not just primary.
- **Nominal-UTC time rendering** — All time displays read `HH:MM` substring directly (no `toLocaleTimeString` TZ shift). Hold collision is strict (`<`/`>`), so adjacent slots [09,10] and [10,11] no longer collide.

---

## System Requirements

### Minimum
- **OS**: Ubuntu 22.04+ / Debian 12+ / macOS 13+
- **RAM**: 2 GB
- **Disk**: 20 GB
- **Docker**: 24.x or newer
- **Docker Compose**: v2.x
### Recommended
- **RAM**: 4 GB
- **CPU**: 2 cores
- **Disk**: 40 GB SSD
- **Domain**: Registered domain with DNS access

### Check Your Versions
```bash
docker --version
docker compose version
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
git clone https://github.com/dedebono/roomflow.git
cd roomflow
cp .env.example .env
nano .env
```

### 2. Start Services
```bash
sudo docker compose up -d
sleep 20
```

### 3. Apply Database Migrations
```bash
sudo docker compose exec backend npx prisma migrate deploy
sudo docker compose exec backend npx prisma db seed 2>/dev/null || echo "Seed skipped"
```

### 4. Verify
```bash
sudo docker compose ps
curl -s http://localhost/api/health
sudo docker compose logs --tail=20
```

**App running at:** `http://YOUR_SERVER_IP` (nginx on 80 → frontend 3001 + backend 3000).

---

## Step-by-Step Setup

### Step 1: Install Docker & Docker Compose
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ca-certificates
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

### Step 2: Configure Environment
```bash
cd roomflow
cp .env.example .env
nano .env
```

**Minimum required:**
```env
POSTGRES_PASSWORD=your_secure_password_here
JWT_SECRET=your_32_plus_char_secret_here  # openssl rand -base64 32
```

**Optional / service-specific:**
```env
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_BASE_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://room.ytcb.org
FRONTEND_BASE_URL=https://your-domain.com
WAHA_API_URL=http://waha:3000
WAHA_API_KEY=your_waha_key
WAHA_SESSION=default
STORAGE_TYPE=LOCAL
EMAIL_ENABLED=false
EMAIL_FROM=noreply@roomflow.local
PAKASIR_SLUG=venueone
PAKASIR_API_KEY=your_pakasir_key
```

### Step 3: Build & Start
```bash
sudo docker compose build
sudo docker compose up -d
sudo docker compose ps
```

Expected:
```
NAME                STATUS
roomflow-postgres   Up (healthy)
roomflow-backend    Up
roomflow-frontend   Up
roomflow-nginx      Up
roomflow-waha       Up
```

### Step 4: Initialize Database
```bash
sudo docker compose exec backend npx prisma migrate deploy
sudo docker compose exec backend npx prisma db seed 2>/dev/null || true
```

### Step 5: Access the Application
```
Frontend:  http://YOUR_SERVER_IP        (nginx → frontend:3001)
API:       http://YOUR_SERVER_IP/api    (nginx → backend:3000)
Uploads:   http://YOUR_SERVER_IP/uploads/
Health:    http://YOUR_SERVER_IP/api/health
WAHA:      http://YOUR_SERVER_IP:3002   (dashboard admin/admin if exposed)
```

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes | `roomflow` | PostgreSQL password |
| `JWT_SECRET` | Yes | — | JWT signing secret (min 32 chars) |
| `DATABASE_URL` | Auto | `postgresql://roomflow:***@postgres:5432/roomflow` | Set in compose; override only for external DB |
| `NEXT_PUBLIC_API_URL` | Yes | `/api` | Frontend API URL (keep `/api` when behind nginx) |
| `NEXT_PUBLIC_BASE_URL` | Yes (Pakasir) | — | Frontend base for Pakasir redirect |
| `FRONTEND_BASE_URL` | Pakasir | — | Backend Pakasir redirect URL |
| `ALLOWED_ORIGINS` | No | — | Comma list; currently not enforced (CORS `origin:true`) |
| `WAHA_ENABLED` | No | `true` | Enable WAHA service |
| `WAHA_API_URL` | If WAHA | — | WAHA URL (`http://waha:3000` in compose) |
| `WAHA_API_KEY` | If WAHA | — | WAHA API key |
| `WAHA_SESSION` | No | `default` | WAHA session name |
| `STORAGE_TYPE` | No | `LOCAL` | LOCAL / S3 / GOOGLE_DRIVE |
| `EMAIL_ENABLED` | No | `false` | Enable email (runtime override in DB `EmailConfig`) |
| `EMAIL_FROM` | No | `noreply@roomflow.local` | From address |
| `PAKASIR_SLUG` | No | — | Pakasir merchant slug |
| `PAKASIR_API_KEY` | If Pakasir | — | Pakasir API key |

### Generate Secure Secrets
```bash
openssl rand -base64 32   # JWT_SECRET
openssl rand -hex 16      # POSTGRES_PASSWORD
```

### Ports (live `docker-compose.yml`)

| Service | Host:Container | Description |
|---------|----------------|-------------|
| Nginx | 80:80 | HTTP (frontend + API + uploads + socket.io) |
| Backend | 3000:3000 | NestJS API (`/api` prefix) |
| Frontend | 3001:3000 | Next.js 16 standalone |
| PostgreSQL | 5432:5432 | Database (`pg_isready` healthcheck) |
| WAHA | 3002:3000 | WhatsApp HTTP API |

Nginx routing: `/socket.io/` → `backend:3000`, `/api/` → `backend:3000/`, `/uploads/` → `backend:3000`, `/` → `frontend:3000`.

---

## API Reference — All Endpoints

Base URL: `/api` (via nginx). Global prefix `api`, global `ValidationPipe` (`whitelist, transform, forbidNonWhitelisted`), `Throttler` 60 req / 60s, JWT guard (except `@Public()`), Roles guard.

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/` | Public | — | Hello |
| GET | `/health` | Public | — | `{status, timestamp, uptime}` |
| POST | `/auth/login` | Public | — | Login → `{accessToken, refreshToken, user}` |
| POST | `/auth/register` | Public | — | Register (OTP flow) |
| POST | `/auth/verify-otp` | Public | — | `{email, otp}` |
| POST | `/auth/resend-otp` | Public | — | `{email}` |
| POST | `/auth/refresh` | Public | — | `{refreshToken}` → new tokens |
| POST | `/auth/logout` | JWT | — | Invalidate refreshToken |
| GET | `/auth/verification-status` | JWT | — | OTP/WhatsApp verification state |
| GET | `/auth/me` | JWT | — | Current user |
| GET | `/users/managers` | JWT | — | List managers |
| POST | `/users` | JWT | ADMIN_IT | Create user |
| GET | `/users` | JWT | ADMIN_IT | List users |
| GET | `/users/:id` | JWT | ADMIN_IT | Get user |
| PATCH | `/users/:id` | JWT | ADMIN_IT | Update user |
| DELETE | `/users/:id` | JWT | ADMIN_IT | Delete user |
| POST | `/buildings` | JWT | ADMIN_IT, ROOM_ADMIN | Create building |
| GET | `/buildings` | JWT | — | List buildings |
| GET | `/buildings/:id` | JWT | — | Get building |
| PATCH | `/buildings/:id` | JWT | ADMIN_IT, ROOM_ADMIN | Update building |
| DELETE | `/buildings/:id` | JWT | ADMIN_IT, ROOM_ADMIN | Delete building |
| POST | `/rooms` | JWT | ADMIN_IT, ROOM_ADMIN | Create room (multipart `image`) |
| GET | `/rooms` | JWT | — | List `?page&limit&buildingId&status` |
| GET | `/rooms/rentable` | Public | — | Rentable rooms |
| GET | `/rooms/:id` | JWT | — | Get room |
| GET | `/rooms/:id/slots` | Public | — | Room + slots |
| PATCH | `/rooms/:id` | JWT | ADMIN_IT, ROOM_ADMIN | Update room (multipart `image`) |
| PATCH | `/rooms/:id/amenities` | JWT | ADMIN_IT, ROOM_ADMIN | `{amenities: string[]}` |
| PATCH | `/rooms/:id/rentable` | JWT | ADMIN_IT, ROOM_ADMIN | `{isRentable: boolean}` |
| PATCH | `/rooms/:id/max-booking-hours` | JWT | ADMIN_IT, ROOM_ADMIN | `{maxBookingHours: number\|null}` |
| DELETE | `/rooms/:id` | JWT | ADMIN_IT, ROOM_ADMIN | Delete room |
| POST | `/bookings` | JWT | — | Create booking |
| GET | `/bookings` | JWT | — | List `?page&limit&roomId&userId` |
| PATCH | `/bookings/:id/cancel` | JWT | — | Cancel (owner or manager) |
| PATCH | `/bookings/:id` | JWT | — | Update booking |
| POST | `/booking-change-requests` | JWT | — | Create change request |
| GET | `/booking-change-requests` | JWT | — | List (scoped by role) |
| PATCH | `/booking-change-requests/:id/approve` | JWT | ADMIN_IT, ROOM_ADMIN | Approve |
| PATCH | `/booking-change-requests/:id/reject` | JWT | ADMIN_IT, ROOM_ADMIN | Reject |
| GET | `/rentals/available-rooms` | Public | — | `?date&startDate&endDate&category` |
| GET | `/rentals/rooms/:id` | Public | — | Room details |
| GET | `/rentals/rooms/:id/availability` | Public | — | `?month` (no-cache) |
| POST | `/rentals/check-availability` | Public | — | `{roomId, date, startTime, endTime}` |
| POST | `/rentals/create-hold` | JWT | — | `{roomId, date, startTime, endTime}` → hold |
| POST | `/rentals/book-from-hold/:holdId` | JWT | — | Convert hold → Booking |
| GET | `/rentals/my-bookings` | JWT | — | Own bookings |
| GET | `/rentals/holds` | JWT | ADMIN_IT, ROOM_ADMIN | All holds `?page&limit` |
| GET | `/rentals/holds/active` | JWT | — | Active holds (own) |
| GET | `/rentals/my-holds` | JWT | — | Own holds |
| GET | `/rentals/stats` | JWT | — | Renter stats |
| GET | `/rentals/holds/:id` | JWT | — | Hold by id (own) |
| DELETE | `/rentals/holds/:id` | JWT | — | Cancel hold |
| GET | `/rentals/slots` | JWT | — | `?roomId&page&limit` |
| GET | `/rentals/available-slots` | JWT | — | `?roomId&date` |
| GET | `/rentals/active-hold` | JWT | — | `?roomId` |
| POST | `/rentals/slots` | JWT | ADMIN_IT, ROOM_ADMIN | Create RentalSlot |
| PATCH | `/rentals/slots/:id` | JWT | ADMIN_IT, ROOM_ADMIN | Update slot |
| DELETE | `/rentals/slots/:id` | JWT | ADMIN_IT, ROOM_ADMIN | Delete slot |
| POST | `/payments/upload` | JWT | — | Multipart `file` + `paymentData {bookingHoldId, amount, description}` |
| GET | `/payments/pending` | JWT | ADMIN_IT, ROOM_ADMIN | Pending payments |
| GET | `/payments/gateways` | Public | — | Enabled gateways |
| PATCH | `/payments/:id/approve` | JWT | ADMIN_IT, ROOM_ADMIN | Approve |
| PATCH | `/payments/:id/reject` | JWT | ADMIN_IT, ROOM_ADMIN | Reject `{notes?}` |
| GET | `/payments/my` | JWT | — | Own payments |
| POST | `/payments/initiate` | JWT | — | `{bookingHoldId, gatewayId, amount?, paymentMethod?}` → Pakasir |
| GET | `/payments/confirm-callback` | Public | — | Pakasir redirect `?order_id&status` |
| POST | `/payment-gateways` | JWT | ADMIN_IT | Create gateway |
| GET | `/payment-gateways/available` | Public | — | Enabled gateways (renter) |
| GET | `/payment-gateways` | JWT | ADMIN_IT | List all |
| GET | `/payment-gateways/:id` | JWT | ADMIN_IT | Get one |
| PATCH | `/payment-gateways/:id` | JWT | ADMIN_IT | Update |
| PATCH | `/payment-gateways/:id/toggle` | JWT | ADMIN_IT | `{enabled: boolean}` |
| DELETE | `/payment-gateways/:id` | JWT | ADMIN_IT | Delete |
| POST | `/pakasir/webhook` | Public | — | `{order_id, status, amount?, payment_method?}` → Payment/Booking/Hold |
| POST | `/chat/send` | JWT | — | `{receiverId, content, roomId?, bookingId?}` |
| GET | `/chat/conversations` | JWT | — | Own conversations |
| POST | `/chat/conversations` | JWT | — | `{participantId}` create/get |
| GET | `/chat/conversation/:userId` | JWT | — | Messages with user |
| PATCH | `/chat/read/:senderId` | JWT | — | Mark read |
| POST | `/chat/mark-read/:participantId` | JWT | — | Mark read (alias) |
| GET | `/chat/unread-count` | JWT | — | Unread count |
| GET | `/notifications` | JWT | — | Own notifications |
| GET | `/notifications/unread-count` | JWT | — | Unread count |
| PATCH | `/notifications/:id/read` | JWT | — | Mark one read |
| PATCH | `/notifications/read-all` | JWT | — | Mark all read |
| DELETE | `/notifications/:id` | JWT | — | Delete notification *(new 2026-10-16)* |
| GET | `/storage/config` | JWT | ADMIN_IT | `{storageType}` |
| POST | `/storage/config` | JWT | ADMIN_IT | `{storageType}` |
| GET | `/waha-config` | JWT | ADMIN_IT | WAHA runtime config |
| PUT | `/waha-config` | JWT | ADMIN_IT | `{enabled?, wahaUrl?, wahaSession?, wahaApiKey?}` |
| GET | `/email-config` | JWT | ADMIN_IT | Email runtime config |
| PUT | `/email-config` | JWT | ADMIN_IT | `{enabled?, host?, port?, secure?, user?, pass?, fromAddress?}` |
| POST | `/email-config/test` | JWT | ADMIN_IT | `{to}` test send |

Auth: `Authorization: Bearer <JWT>`. Public routes use `@Public()`.

---

## Database Schema

Prisma `postgresql` on `DATABASE_URL`. Schema: `backend/prisma/schema.prisma`. Migrations in `backend/prisma/migrations/` (last: `20260717000000_add_email_config`).

### Enums

| Enum | Values |
|------|--------|
| `Role` | `ADMIN_IT`, `ROOM_ADMIN`, `USER`, `RENTER` |
| `RoomStatus` | `ACTIVE`, `MAINTENANCE` |
| `RoomCategory` | `EVENT`, `SPORT` |
| `BookingStatus` | `PENDING`, `BOOKED`, `CANCELLED` |
| `ChangeRequestStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `PaymentStatus` | `PENDING`, `PAYMENT_PROOF_UPLOADED`, `APPROVED`, `REJECTED` |
| `BookingHoldStatus` | `ACTIVE`, `CONVERTED`, `EXPIRED`, `CANCELLED` |
| `NotificationType` | `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_CONFIRMED`, `BOOKING_EXPIRED`, `PAYMENT_UPLOADED`, `PAYMENT_PROOF_UPLOADED`, `PAYMENT_APPROVED`, `PAYMENT_REJECTED`, `NEW_MESSAGE`, `RENTAL_BOOKED`, `CHANGE_REQUEST_SUBMITTED`, `CHANGE_REQUEST_APPROVED`, `CHANGE_REQUEST_REJECTED` |

### Models

**User** — `id uuid PK, name, email @unique, whatsappNumber?, whatsappVerified Boolean, whatsappOtpCode?, whatsappOtpExpiresAt?, passwordHash, refreshToken?, role Role, createdAt, updatedAt` — relations: `bookings`, `bookingChangeRequests`, `payments`, `managedPayments (ApprovedPayments)`, `sentMessages/receivedMessages`, `bookingHolds`, `notifications`.

**Building** — `id uuid PK, name, createdAt, updatedAt` — `rooms[]`.

**Room** — `id uuid PK, buildingId FK→Building CASCADE, name, capacity Int, description?, imageUrl?, status RoomStatus, amenities String? (CSV), isRentable Boolean, maxBookingHours Int?, category RoomCategory?, createdAt, updatedAt` — `bookings[]`, `rentalSlots[]`, `bookingHolds[]`, `chatMessages[]` — indexes `[buildingId]`, `[status]`.

**Booking** — `id uuid PK, roomId FK→Room CASCADE, userId FK→User CASCADE, title, notes?, startTime DateTime, endTime DateTime, status BookingStatus, isRental Boolean, bookingHoldId String?, createdAt, updatedAt` — `payment[]`, `changeRequests[]` — indexes `[roomId]`, `[userId]`, `[startTime, endTime]`, `[status]`.

**BookingChangeRequest** — `id uuid PK, bookingId FK→Booking CASCADE, requestedById FK→User, requestedRoomId?, requestedStart?, requestedEnd?, reason?, status ChangeRequestStatus, createdAt, updatedAt` — indexes `[bookingId]`, `[requestedById]`, `[status]`.

**Payment** — `id uuid PK, bookingId FK→Booking CASCADE, bookingHoldId FK→BookingHold?, userId FK→User, amount Float, status PaymentStatus, paymentMethod String?, proofImageUrl?, fileUrl?, managerId FK→User?, approvedAt?, notes?, externalId String? @unique, paymentGatewayId FK→PaymentGateway?, createdAt, updatedAt` — indexes `[userId]`, `[status]`, `[bookingId]`, `[bookingHoldId]`.

**PaymentGateway** — `id uuid PK, name @unique, logo?, config Json?, enabled Boolean, createdAt, updatedAt` — `payments[]`.

**ChatMessage** — `id uuid PK, senderId FK→User, receiverId FK→User, content, roomId FK→Room?, bookingId?, isRead Boolean, createdAt` — indexes `[senderId]`, `[receiverId]`, `[roomId]`, `[bookingId]`.

**RentalSlot** — `id uuid PK, roomId FK→Room CASCADE, dayOfWeek Int (0=Sun), startTime String, endTime String, price Float, isActive Boolean` — unique `[roomId, dayOfWeek, startTime, endTime]`, index `[roomId, dayOfWeek, isActive]`.

**BookingHold** — `id uuid PK, userId FK→User CASCADE, roomId FK→Room CASCADE, holdDate DateTime, startTime DateTime, endTime DateTime, expiresAt DateTime, price Float, status BookingHoldStatus, paymentId @unique?, createdAt, updatedAt` — `payments[]` — indexes `[userId]`, `[roomId]`, `[holdDate]`, `[status]`, `[expiresAt]`, `[paymentId]`.

**Notification** — `id uuid PK, userId FK→User CASCADE, type NotificationType, title, message, data String?, isRead Boolean, createdAt` — indexes `[userId, isRead]`, `[createdAt]`.

**WahaConfig** — `id uuid PK, enabled Boolean, wahaUrl String?, wahaSession String default "default", wahaApiKey String?, createdAt, updatedAt` — singleton row seeded `enabled=true`.

**EmailConfig** — `id uuid PK, enabled Boolean, host String?, port Int 587, secure Boolean, user String?, pass String?, fromAddress String default "noreply@roomflow.local", createdAt, updatedAt` — singleton.

Relations match `schema.prisma` FK `onDelete` rules.

---

## Realtime & WebSocket

- **Gateway**: `RoomFlowWebSocketGateway` (`@WebSocketGateway` with `ws`, CORS `*`), `IoAdapter` on backend. Connect: `ws://HOST/socket.io/?token=<JWT>` (JWT `sub` = userId). No token → disconnect.
- **Client→Server**: `ping` → `pong`.
- **Server→Client**: `booking_update`, `payment_update`, `new_message` (to sender+receiver), `notification` — all JSON `{type, data}`. Used by chat, payment approval, booking changes.

---

## Custom Domain & HTTPS

### Option 1: Cloudflare Tunnel (Recommended — Free)
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
cloudflared tunnel create roomflow
cloudflared tunnel list
cloudflared tunnel route dns <TUNNEL_ID> room.ytcb.org
sudo docker compose restart nginx
```

### Option 2: Let's Encrypt HTTPS (Self-Hosted)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo docker compose stop nginx
sudo certbot --nginx -d your-domain.com --non-interactive --agree-tos -m admin@your-domain.com
sudo docker compose start nginx
```

### Option 3: Reverse Proxy (Nginx/Caddy on Host)
```yaml
nginx:
  ports:
    - '8080:80'
```
Forward HTTPS from host proxy to `localhost:8080`.

---

## Database Management

### Connect to PostgreSQL
```bash
sudo docker compose exec postgres psql -U roomflow -d roomflow
sudo docker compose exec postgres psql -U roomflow -d roomflow -c "SELECT COUNT(*) FROM \"Room\";"
```

### Create Migrations
```bash
sudo docker compose exec backend npx prisma migrate dev --name add_feature
sudo docker compose exec backend npx prisma migrate deploy
```

### Reset Database
```bash
sudo docker compose exec backend npx prisma migrate reset --force
```

### Backup Database
```bash
sudo docker compose exec postgres pg_dump -U roomflow roomflow > backup_$(date +%Y%m%d_%H%M%S).sql
cat backup_file.sql | sudo docker compose exec -T postgres psql -U roomflow -d roomflow
```

### View/Edit Data via Prisma Studio
```bash
sudo docker compose exec backend npx prisma studio
```

---

## Troubleshooting

### Services Won't Start
```bash
sudo docker compose logs
sudo docker compose logs backend
sudo docker compose logs postgres
sudo docker compose logs nginx
sudo docker compose restart
```

### Database Connection Error
```bash
sleep 30
sudo docker compose ps postgres
sudo docker compose exec backend env | grep DATABASE
```

### Frontend Build Fails
```bash
sudo docker compose build --no-cache frontend
sudo docker compose up -d frontend
```

### 502 Bad Gateway
```bash
cat nginx.conf | grep proxy_pass
sudo docker network inspect roomflow_default
sudo docker compose restart nginx
```

### Prisma Migration Error
```bash
sudo docker compose exec backend npx prisma migrate reset --force
sudo docker compose exec backend npx prisma migrate deploy
```

### WhatsApp Not Working
```bash
sudo docker compose logs backend | grep -i waha
cat .env | grep WAHA
curl -H "x-api-key: ***" "$WAHA_API_URL/api/sessions"
```

### Reset Everything (Fresh Start)
```bash
sudo docker compose down
sudo docker compose down -v
sudo docker image prune -a
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
│   │   ├── auth/              # JWT + OTP
│   │   ├── users/             # User CRUD (ADMIN_IT)
│   │   ├── buildings/         # Building CRUD
│   │   ├── rooms/             # Room CRUD + rentable/category/amenities/image
│   │   ├── bookings/          # Booking management
│   │   ├── booking-change-requests/ # Change requests
│   │   ├── rentals/           # RentalSlot + BookingHold + availability
│   │   ├── payments/          # Upload/initiate/approve/reject + Pakasir callback
│   │   ├── payment-gateways/  # Gateway CRUD (Pakasir etc.)
│   │   ├── pakasir/           # Pakasir webhook
│   │   ├── chat/              # Messaging
│   │   ├── notifications/     # In-app alerts (now with delete)
│   │   ├── storage/           # File upload + sharp compression
│   │   ├── whatsapp/          # WAHA sender
│   │   ├── waha-config/       # Runtime WAHA config (DB)
│   │   ├── email/             # Nodemailer
│   │   ├── email-config/      # Runtime email config (DB)
│   │   ├── websocket/         # WS gateway (ws lib)
│   │   └── common/            # Guards, decorators, pipes, filters
│   ├── prisma/
│   │   ├── schema.prisma       # All models + enums
│   │   └── migrations/         # 11 migrations
│   └── Dockerfile
├── frontend/                   # Next.js 16 standalone
│   ├── src/app/
│   │   ├── renter/            # Renter pages (rooms, calendar, payment)
│   │   ├── dashboard/         # Manager/Admin
│   │   ├── admin/              # System administration (WAHA/Email)
│   │   └── (auth)/            # Login, register
│   ├── src/components/
│   │   ├── landing/           # Public landing
│   │   ├── rental/            # RoomCalendar, TimeSlotSelector, BookingSummary
│   │   └── ui/                # Shared UI
│   ├── src/lib/format.ts      # formatRupiah/formatDate/formatTime/formatDateTime
│   └── Dockerfile
├── .github/deploy/nginx.Dockerfile
├── scripts/
│   ├── setup.sh
│   └── migrate.sh
├── docker-compose.yml          # postgres, backend, frontend, nginx, waha
├── nginx.conf                  # Reverse proxy (baked into image)
├── .env.example
├── .env
├── .gitignore
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
sudo docker compose logs -f
sudo docker compose logs -f backend
sudo docker compose ps
sudo docker stats --no-stream
```

---

**Last Updated**: 2026-10-16 | **Version**: main @ 1f7fa45 + worktree | **License**: MIT
