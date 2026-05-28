# RoomFlow — Enterprise Room Booking & Rental Engine

## Project Overview
RoomFlow is a full-stack workspace booking + hourly rental application. Multi-tenant support with role-based access (ADMIN, ROOM_ADMIN, RENTER, USER). Built with NestJS (backend), Next.js (frontend), PostgreSQL, Docker Compose. Live at `https://room.ytcb.org` via Cloudflare tunnel.

## Current Status: 🚧 PHASE 6 — Renter Testing & Bug Fixes

---

## Architecture

### Tech Stack
- **Backend**: NestJS 10, Prisma ORM, PostgreSQL 16, JWT auth
- **Frontend**: Next.js 14, React 18, Tailwind CSS, TypeScript
- **Deployment**: Docker Compose, Cloudflare Tunnel
- **Database**: PostgreSQL (schema in `/backend/prisma/schema.prisma`)

### Key Models
| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `Room` | Bookable spaces | `name`, `capacity`, `isRentable`, `maxBookingHours`, `imageUrl`, `amenities` |
| `RentalSlot` | Hourly availability | `roomId`, `dayOfWeek`, `startTime`, `endTime`, `price`, `isActive` |
| `BookingHold` | 1-hour rental hold | `userId`, `roomId`, `holdDate`, `startTime`, `endTime`, `expiresAt`, `status` (ACTIVE/CONVERTED/EXPIRED) |
| `Booking` | Confirmed rental | `userId`, `roomId`, `startTime`, `endTime`, `isRental`, `status` |
| `Payment` | Receipt upload | `bookingHoldId`, `userId`, `amount`, `proofUrl`, `status` (PENDING/APPROVED/REJECTED) |
| `Notification` | In-app alerts | `userId`, `type`, `title`, `message`, `metadata`, `isRead` |

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
- Seed data: 4 rooms × 5 days × 9 slots = 180 rental slots

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
- Backend: 9/9 test suites, 45/45 tests PASSED
- Frontend: 1/1 test suite, 6/6 tests PASSED

---

## Current Issues 🔴

### Issue 1: Time Slots Not Rendering on Frontend
**Status**: IN PROGRESS
- **Symptom**: Room detail page shows date picker but no time slots appear after date selection
- **Root Cause**: Frontend `fetchTimeSlots` receives empty string `""` instead of array
- **Verification**: API works via curl — returns 9 slots for 2026-05-29 (Friday)
- **Fixes Applied**:
  - Backend `getAvailableSlots` service refactored (removed early return, added logging)
  - Frontend `page.tsx` fixed (ISO time format extraction for `createHold`)
  - Both Docker images rebuilt
- **Next Steps**: 
  - Verify frontend API call is triggered on date change
  - Check network tab for response structure
  - Add console.log to `fetchTimeSlots` to debug

### Issue 2: Debug Console.log Visible on Rooms List
**Status**: PENDING
- **Symptom**: Text "res.data type: object, isArray: true, keys: 0,1,2, length: 3" appears on `/renter/rooms` page
- **Location**: Likely in `rooms/page.tsx` line ~70
- **Fix**: Remove debug `console.log` statements

### Issue 3: Refresh Button Doesn't Clear Search Filter
**Status**: PENDING
- **Symptom**: Clicking "Refresh" on rooms list doesn't clear search input field
- **Location**: `rooms/page.tsx` Refresh button handler
- **Fix**: Add `setSearchTerm('')` to refresh handler

---

## Renter Testing Checklist

| Task | Status | Notes |
|------|--------|-------|
| Login (jack@mail.com / 12345678) | ✅ | Works |
| Dashboard verification | ✅ | Stats, active holds display |
| Browse rooms (search, filters) | ✅ | Search works, Refresh button broken |
| View room details | ✅ | Image, amenities, description load |
| Select date & view time slots | 🔴 | Slots API returns data but frontend shows empty |
| Create booking hold | ⏳ | Blocked by Issue 1 |
| Upload payment proof | ⏳ | Blocked by Issue 1 |
| View My Bookings | ⏳ | Pending |
| View Payments history | ⏳ | Pending |
| Test messaging | ⏳ | Pending |
| Sign out | ⏳ | Pending |

---

## Database Setup

### Seed Rental Data
```sql
-- Mark rooms as rentable
UPDATE "Room" SET "isRentable" = true WHERE "name" IN ('Executive Suite 301', 'Large Hall 201', 'Meeting Room 102', 'Conference Room 101');

-- Add rental slots (already seeded for 4 rooms, Mon-Fri 09:00-18:00)
-- Executive Suite 301: 45 slots @ $120/hr
-- Large Hall 201: 45 slots @ $80/hr
-- Meeting Room 102: 45 slots @ $45/hr
-- Conference Room 101: 45 slots @ $60/hr (some disabled for testing)
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
| GET | `/api/rentals/available-rooms` | Public | List rentable rooms |
| GET | `/api/rentals/available-slots` | Auth | Get hourly slots for room+date |
| POST | `/api/rentals/create-hold` | Auth | Create 1-hour booking hold |
| GET | `/api/rentals/my-bookings` | Auth | Renter's confirmed bookings |
| GET | `/api/rentals/my-holds` | Auth | Renter's active holds |
| GET | `/api/rentals/active-hold` | Auth | Get active hold for room |
| GET | `/api/rentals/holds` | Auth | Manager: all holds |
| POST | `/api/rentals/book-from-hold/:holdId` | Auth | Convert hold to booking |

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
│   │   ├── rentals/          # Rental booking logic
│   │   ├── payments/         # Payment upload & approval
│   │   ├── chat/             # Messaging
│   │   ├── notifications/    # In-app alerts
│   │   ├── rooms/            # Room CRUD
│   │   ├── auth/             # JWT auth
│   │   └── common/           # Decorators, guards, pipes
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   └── Dockerfile
├── frontend/
│   ├── src/app/
│   │   ├── renter/           # Renter pages (dashboard, rooms, payments, chat)
│   │   ├── dashboard/        # Manager pages (rentals, chat, notifications)
│   │   ├── admin/            # Admin pages (rooms, users, system)
│   │   └── auth/             # Login, register
│   ├── src/components/       # Reusable UI components
│   ├── src/lib/              # API client, utilities
│   └── Dockerfile
├── docker-compose.yml        # Services: postgres, backend, frontend, nginx
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
# Postgres: localhost:5432
```

### Production (Cloudflare Tunnel)
```bash
# Tunnel already configured at https://room.ytcb.org
# Nginx routes:
#   / → frontend:3001
#   /api → backend:3000
```

### Rebuild Services
```bash
# Rebuild backend
sudo docker compose up -d --build backend

# Rebuild frontend
sudo docker compose up -d --build frontend

# Rebuild all
sudo docker compose up -d --build
```

---

## Known Limitations

1. **No Payment Gateway**: Payments are receipt uploads only (no Stripe/PayPal integration)
2. **Single Timezone**: All times in UTC (no timezone conversion)
3. **No Email Notifications**: Only in-app notifications (no email alerts)
4. **No Recurring Bookings**: Each rental is a one-time 1-hour slot
5. **No Cancellation Fees**: Cancellations are free (no penalty logic)

---

## Next Steps

1. **Fix Issue 1** (Time Slots): Debug frontend API call, verify response structure
2. **Fix Issue 2** (Debug Log): Remove console.log from rooms list
3. **Fix Issue 3** (Refresh): Clear search input on refresh
4. **Complete Renter Testing**: Finish remaining checklist items
5. **Manager Testing**: Verify payment approval/rejection flow
6. **Load Testing**: Test with 100+ concurrent users
7. **Security Audit**: Review auth, input validation, SQL injection risks

---

## Support

- **Tunnel Status**: `https://room.ytcb.org`
- **Backend Logs**: `sudo docker compose logs backend -f`
- **Frontend Logs**: `sudo docker compose logs frontend -f`
- **Database**: `sudo docker compose exec postgres psql -U roomflow -d roomflow`

---

**Last Updated**: 2026-05-28 | **Phase**: 6 (Renter Testing & Bug Fixes)
