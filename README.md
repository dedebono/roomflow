# RoomFlow — Enterprise Room Booking & Rental Engine

## Project Overview
RoomFlow is a full-stack workspace booking + hourly rental application. Multi-tenant support with role-based access (ADMIN, ROOM_ADMIN, RENTER, USER). Built with NestJS (backend), Next.js (frontend), PostgreSQL, Docker Compose. Live at `https://room.ytcb.org` via Cloudflare tunnel.

## Current Status: ✅ PHASE 10+ — Full Renter Flow + Room Categories

---

## Architecture

### Tech Stack
- **Backend**: NestJS 10, Prisma ORM, PostgreSQL 16, JWT auth
- **Frontend**: Next.js 16, React 18, Tailwind CSS, TypeScript
- **Deployment**: Docker Compose, Cloudflare Tunnel, Nginx
- **Database**: PostgreSQL (schema in `/backend/prisma/schema.prisma`)

### Key Models
| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `Room` | Bookable spaces | `name`, `capacity`, `isRentable`, `maxBookingHours`, `imageUrl`, `amenities`, `category` |
| `RentalSlot` | Hourly availability | `roomId`, `dayOfWeek`, `startTime`, `endTime`, `price`, `isActive` |
| `BookingHold` | 1-hour rental hold | `userId`, `roomId`, `holdDate`, `startTime`, `endTime`, `expiresAt`, `status` (ACTIVE/CONVERTED/EXPIRED) |
| `Booking` | Confirmed rental | `userId`, `roomId`, `startTime`, `endTime`, `isRental`, `status` |
| `Payment` | Receipt upload | `bookingHoldId`, `userId`, `amount`, `fileUrl`, `status` (PENDING/APPROVED/REJECTED) |
| `Notification` | In-app alerts | `userId`, `type`, `title`, `message`, `data`, `isRead` |
| `Building` | Physical location | `id`, `name` |

### Room Categories
Rooms are classified by type via the `RoomCategory` enum:
- `EVENT` — Event halls, meeting rooms, conference spaces
- `SPORT` — Sports facilities, courts, arenas

Current room assignments:
| Room | Category |
|------|----------|
| Lapangan basket | SPORT |
| Meeting Room 102 | EVENT |
| Workstation Area | EVENT |
| Large Hall 201 | EVENT |
| MLB CENTER | EVENT |

---

## Features Implemented ✅

### Phase 1: Frontend Build Fixes ✅
- Fixed JSX root elements in all `/renter/` pages
- Resolved Badge component conflicts
- Fixed type definitions for `BookingHold`, `RentalSlot`, `Room`

### Phase 2: Admin Rental Config ✅
- `RentalSlot` CRUD endpoints (`GET/POST/PATCH/DELETE /rentals/slots`)
- Admin UI: room edit modal with `maxBookingHours` input
- Rentable column in admin rooms table

### Phase 3: Renter Booking Flow ✅
- 1-hour countdown timer on payment page (live MM:SS display)
- Auto-cancel expired holds (30s interval check)
- Room photos on detail page
- Seed data: rooms with rental slots across Mon-Fri

### Phase 4: Manager Payment Dashboard ✅
- `/dashboard/rentals` — list booking holds with approve/reject actions
- Payment approve/reject flow with notifications
- Chat dashboard with renter messaging
- Notification bell with unread count

### Phase 5: Modification Requests ✅
- USER role cannot cancel/reschedule directly
- "Request Cancellation" modal for USER role
- Manager approval/rejection with notifications

### Phase 6: End-to-End Testing ✅
- Full rental flow tested (register → browse → book → pay → approve)
- Notifications fire on booking events
- Chat works between renter and manager

### Phase 7: Room Image Compression ✅
- Images compressed to WebP (1200×800px, 80% quality) via Sharp library
- Graceful fallback to original if compression fails
- Stored locally at `/app/dist/uploads/` with Docker volume persistence
- Frontend uses `getImageUrl()` helper for full CDN URLs

### Phase 8: Landing Page Live Availability ✅
- Landing page fetches live data from `/api/rentals/available-rooms`
- `SportsZone` shows SPORT rooms, `EventZone` shows EVENT rooms
- `FeaturedSpaces` and `LiveAvailability` show all rooms
- Price derived from minimum rental slot price
- Availability checked against active bookings and holds per slot

### Phase 9: Full Renter Flow End-to-End ✅
- Login → Browse rooms → Select date → View time slots → Create hold → Upload payment → Manager approves → Booking confirmed
- All workflows tested and verified:
  - Login ✅
  - Browse rooms ✅
  - Create holds ✅
  - View bookings ✅
  - Payments (upload + re-upload on rejection) ✅
  - Messages ✅
  - Chat ✅

### Phase 10: Room Categories ✅
- Added `RoomCategory` enum (`EVENT`, `SPORT`) to Prisma schema
- Added `category` field to `Room` model
- Database migration applied; existing rooms force-categorized
- Backend `getAvailableRooms` accepts `?category=SPORT|EVENT` query param
- Backend `rentalSlots.findMany` corrected to use `include` (not `select`) for relation
- Admin room creation modal includes category dropdown (EVENT/SPORT)
- Renter rooms list displays category badge per room
- Landing page fetches three room sets: SPORT, EVENT, all — for respective sections

---

## Current Issues 🟡

### Issue 1: Refresh Button Doesn't Clear Search Filter
**Status**: RESOLVED (2026-06-01)
- Refresh button now clears search term

### Issue 2: Debug Console.log on Rooms List
**Status**: RESOLVED (2026-06-01)
- Debug log statements removed from rooms list page

### Issue 3: RentalSlots Not Returning in findAll
**Status**: RESOLVED (2026-06-01)
- `rooms.service.ts` `findAll` changed from `select` to `include` for `rentalSlots`
- Now returns full rental slot data with rooms

---

## Renter Testing Checklist
| Task | Status | Notes |
|------|--------|-------|
| Login (jack@mail.com / 12345678) | ✅ | Works |
| Dashboard verification | ✅ | Stats, active holds display |
| Browse rooms (search, filters) | ✅ | Category filter + search work |
| View room details | ✅ | Image, amenities, description load |
| Select date & view time slots | ✅ | API returns data, frontend renders |
| Create booking hold | ✅ | Countdown timer starts |
| Upload payment proof | ✅ | Image upload works |
| View My Bookings | ✅ | Booking list displays |
| View Payments history | ✅ | Payment history displays |
| Test messaging | ✅ | Chat works |
| Sign out | ✅ | Works |

---

## Database Setup

### Room Categories SQL
```sql
-- Update room categories
UPDATE "Room" SET category = 'SPORT' WHERE name ILIKE '%basket%';
UPDATE "Room" SET category = 'EVENT' WHERE category IS NULL;

-- Verify
SELECT name, category FROM "Room";
```

### Seed Rental Data
```sql
-- Mark rooms as rentable
UPDATE "Room" SET "isRentable" = true WHERE "name" IN ('Executive Suite 301', 'Large Hall 201', 'Meeting Room 102', 'Conference Room 101', 'MLB CENTER', 'Lapangan basket');
```

### Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Renter | jack@mail.com | 12345678 |
| Manager | manager@roomflow.local | password123 |
| Admin | admin@roomflow.local | password123 |

---

## API Endpoints

### Rentals
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/rentals/available-rooms` | Public | List rentable rooms (supports `?category=SPORT&EVENT&date=YYYY-MM-DD`) |
| GET | `/api/rentals/available-slots` | Auth | Get hourly slots for room+date |
| POST | `/api/rentals/create-hold` | Auth | Create 1-hour booking hold |
| GET | `/api/rentals/my-bookings` | Auth | Renter's confirmed bookings |
| GET | `/api/rentals/my-holds` | Auth | Renter's active holds |
| GET | `/api/rentals/active-hold` | Auth | Get active hold for room |
| GET | `/api/rentals/holds` | Auth | Manager: all holds |
| POST | `/api/rentals/book-from-hold/:holdId` | Auth | Convert hold to booking |
| POST | `/api/rentals/check-availability` | Public | Check room availability |

### Rooms
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/rooms` | Public | List all rooms |
| GET | `/api/rooms/:id` | Public | Get room by ID |
| POST | `/api/rooms` | Auth | Create room |
| PATCH | `/api/rooms/:id` | Auth | Update room |
| DELETE | `/api/rooms/:id` | Auth | Delete room |

### Payments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/payments/upload` | Auth | Upload payment receipt (multipart) |
| PATCH | `/api/payments/:id/approve` | Auth | Manager approves payment |
| PATCH | `/api/payments/:id/reject` | Auth | Manager rejects payment |

### Chat
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/chat/conversations` | Auth | List conversations |
| POST | `/api/chat/conversations` | Auth | Create/get conversation |
| POST | `/api/chat/send` | Auth | Send message |
| POST | `/api/chat/mark-read/:participantId` | Auth | Mark conversation read |

### Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Auth | List user notifications |
| PATCH | `/api/notifications/:id/read` | Auth | Mark notification read |

---

## File Structure

```
/home/ubuntu/roomflow/
├── backend/
│   ├── src/
│   │   ├── rentals/          # Rental booking logic + rental slots
│   │   ├── payments/         # Payment upload & approval
│   │   ├── chat/             # Messaging
│   │   ├── notifications/    # In-app alerts
│   │   ├── rooms/            # Room CRUD + category
│   │   ├── storage/          # Image upload + Sharp compression
│   │   ├── auth/             # JWT auth
│   │   └── common/           # Decorators, guards, pipes
│   ├── prisma/
│   │   └── schema.prisma     # Database schema (includes RoomCategory enum)
│   └── Dockerfile
├── frontend/
│   ├── src/app/
│   │   ├── renter/           # Renter pages (dashboard, rooms, bookings, payments, chat)
│   │   ├── dashboard/        # Manager pages (rentals, chat, notifications)
│   │   ├── admin/            # Admin pages (rooms, users, system)
│   │   ├── auth/             # Login, register
│   │   └── (public)/         # Landing page, public routes
│   ├── src/components/
│   │   ├── landing/          # Landing page sections (SportsZone, EventZone, etc.)
│   │   ├── ui/              # Reusable UI components (Button, Card, Input, etc.)
│   │   └── ...
│   ├── src/lib/              # API client, utilities
│   └── Dockerfile
├── docker-compose.yml          # Services: postgres, backend, frontend, nginx
└── README.md                 # This file
```

---

## Deployment

### Local Development
```bash
cd /home/ubuntu/roomflow
sudo docker compose up -d
# Frontend: http://localhost:3001
# Backend: http://localhost:3000
# Nginx: http://localhost
# Postgres: localhost:5432
```

### Production (Cloudflare Tunnel)
```bash
# Tunnel configured at https://room.ytcb.org
# Nginx routes:
#   /         → frontend:3000
#   /api      → backend:3000
#   /uploads/ → backend:3000
```

### Rebuild Services
```bash
# Rebuild backend (use --no-cache for schema changes)
cd /home/ubuntu/roomflow
sudo docker compose build --no-cache backend
sudo docker compose up -d backend

# Rebuild frontend (use --no-cache for frontend changes)
sudo docker compose build --no-cache frontend
sudo docker compose up -d frontend

# Full rebuild
sudo docker compose build --no-cache
sudo docker compose up -d
```

### Database Migrations
```bash
cd /home/ubuntu/roomflow/backend
npx prisma migrate dev --name <migration_name>
npx prisma generate
```

---

## Known Limitations
1. **No Payment Gateway**: Payments are receipt uploads only (no Stripe/PayPal integration)
2. **Single Timezone**: All times in UTC (no timezone conversion)
3. **No Email Notifications**: Only in-app notifications (no email alerts)
4. **No Recurring Bookings**: Each rental is a one-time slot
5. **No Cancellation Fees**: Cancellations are free (no penalty logic)

---

## Next Steps
1. **Recurring Bookings**: Support weekly/monthly recurring rentals
2. **Email Notifications**: Integrate SMTP for booking confirmations and reminders
3. **Calendar View**: Visual calendar for room availability
4. **Waitlist**: Notify users when a held slot becomes available
5. **Analytics Dashboard**: Occupancy rates, revenue per room, peak hours
6. **Recategorization**: Allow rooms to belong to both EVENT and SPORT categories

---

## Support
- **Tunnel Status**: `https://room.ytcb.org`
- **Backend Logs**: `sudo docker compose logs backend -f`
- **Frontend Logs**: `sudo docker compose logs frontend -f`
- **Nginx Logs**: `sudo docker compose logs nginx -f`
- **Database**: `sudo docker exec roomflow-postgres psql -U roomflow -d roomflow`

---

**Last Updated**: 2026-06-01 | **Phase**: 10+ (Full Renter Flow + Room Categories)
