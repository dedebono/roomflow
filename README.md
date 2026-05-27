# RoomFlow Rental Feature — Implementation Plan

## Project
RoomFlow workspace booking + rental app. Docker Compose (NestJS backend + Next.js frontend + PostgreSQL). Cloudflare tunnel: `https://room.ytcb.org`

## Current Status: 🚧 IN PROGRESS

---

## PART A: FIX Frontend Build Errors
**Priority: BLOCKING — frontend won't compile until fixed**

### A1. Fix JSX Errors in Renter Pages
All `/renter/` pages have malformed `return (...)` — the `RenterLayout` wrapper was removed but the return statements weren't fixed.

| File | Issue | Fix |
|------|-------|-----|
| `renter/bookings/page.tsx` | `return (` followed by blank + `{/* comment */}` | Wrap in `<>` Fragment |
| `renter/dashboard/page.tsx` | Same pattern, line 38 | Wrap in `<>` Fragment |
| `renter/payments/page.tsx` | Same pattern, line 113 | Wrap in `<>` Fragment |
| `renter/rooms/[id]/page.tsx` | Same pattern, line 241 | Wrap in `<>` Fragment |
| `renter/chat/page.tsx` | Same pattern | Wrap in `<>` Fragment |
| `renter/rooms/page.tsx` | Inline `Badge` component conflicts with UI import | Remove duplicate inline Badge, use imported one |

**Fix pattern:**
```tsx
// BROKEN:
return (
  
  {/* comment */}
  <Card>...</Card>
);

// FIXED:
return (
  <>
    {/* comment */}
    <Card>...</Card>
  </>
);
```

### A2. Rebuild & Verify
```bash
cd /home/ubuntu/roomflow && sudo docker compose build frontend
sudo docker compose up -d frontend
```

---

## PART B: IT Admin Features
**Priority: HIGH**

### B1. Setup Available Time/Day for Renter Booking
- Add `availableTimeConfig` model or field in `RentalSlot` or a new `RentalConfig` model
- Admin UI: `/admin/rooms/page.tsx` — add time range picker (start hour, end hour) and day-of-week selector
- **Backend**: `RentalConfig` model with fields: `dayOfWeek`, `startHour`, `endHour`, `maxBookingHours`, `roomId`
- **Frontend**: Edit room → "Rental Settings" tab with time slots editor

### B2. Setup Max Booking Time
- Add `maxBookingHours: Int` field to `RentalConfig` or `Room`
- Enforce in `RentalsService.createBookingHold()` — reject if requested duration > max
- **Frontend**: In admin room settings, input "Max booking hours per session"

---

## PART C: Renter (RENTER Role) Dashboard
**Priority: HIGH**

### C1. 1-Hour Booking Only
- Time slot picker shows only 1-hour increments
- User selects start time → automatically endTime = startTime + 1hr
- Display clearly: "You are booking 1 hour starting at [time]"

### C2. After "Book Room" → Payment Page with 1hr Countdown
- "Book" button creates `BookingHold` (status: ACTIVE) and redirects to `/renter/payments`
- Payment page shows:
  - Room name, date, time, price
  - Countdown timer (1 hour from hold creation)
  - Upload receipt form
  - "If payment not received within 1 hour, booking is automatically cancelled"
- Backend: Countdown is tracked via `BookingHold.expiresAt` field
- Frontend: Use `setInterval` to update countdown every second

### C3. Payment Page — Upload Receipt Only
- File upload (image/PDF) to `POST /api/payments/upload`
- Show booking details summary
- Show status: "Waiting for manager verification..."
- No payment gateway — just receipt upload

### C4. Room Details (Photo) from Building → Room
- Room listing page shows rooms with image
- Click room → detail page shows full photo, amenities, description
- `/renter/rooms/[id]/page.tsx` already has room detail — ensure imageUrl is displayed

---

## PART D: Room Manager (ROOM_ADMIN Role) Dashboard
**Priority: HIGH**

### D1. Payment Dashboard
- `/dashboard/rentals/page.tsx` — list all pending payments
- Show: renter name, room, date/time, amount, payment proof image, status
- Actions: "Approve" (→ booking confirmed) or "Reject" (→ hold cancelled)
- Approve: `PATCH /api/payments/:id/approve` → `BookingHold.status = CONVERTED`
- Reject: `PATCH /api/payments/:id/reject` → `BookingHold.status = CANCELLED`

### D2. Chat Dashboard
- `/dashboard/chat/page.tsx` — manager chats with renters
- Already built by subagent — verify it works

### D3. Updates & Activity Log
- Booking confirmations, rejections, modifications → notifications
- Manager can see booking timeline: "User X booked Room Y at Z time — awaiting payment — approved"
- Use existing `Notification` model + `/dashboard/notifications/page.tsx`

### D4. Modifications & Reschedule Requests Dashboard
- New endpoint: `GET /api/rentals/modification-requests` for managers
- `BookingChangeRequest` model (already exists in schema) — extend for rental use
- Manager UI: list of pending modification requests
- Actions: Approve → update booking, Reject → keep original

---

## PART E: Regular Employee (USER Role) Restrictions
**Priority: MEDIUM**

### E1. Cannot Reschedule or Delete Bookings
- In `Booking` and `BookingHold` models, USER role cannot call DELETE or PATCH (cancel/reschedule)
- Frontend: Hide "Cancel" and "Reschedule" buttons for USER role
- Backend: Add role guard in `BookingsController` — if role === USER, reject cancel/reschedule

### E2. Reschedule Only via Modification Request
- USER can create `BookingChangeRequest` asking manager to reschedule
- New endpoint: `POST /api/bookings/:id/request-change` → creates `BookingChangeRequest`
- Manager sees request in D4 dashboard
- Manager approves → backend updates the booking

---

## PART F: Seed Data & Testing
**Priority: HIGH — needed to verify everything works**

### F1. Seed Rental Data
```sql
-- Mark some rooms as rentable
UPDATE "Room" SET "isRentable" = true WHERE "name" LIKE 'Meeting Room%';

-- Add rental slots (e.g., 9am-6pm weekdays for Meeting Room A)
INSERT INTO "RentalSlot" ("id", "roomId", "dayOfWeek", "startTime", "endTime", "price", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'ROOM_ID_HERE', 1, '09:00', '10:00', 50.00, NOW(), NOW());
```

### F2. Test End-to-End Flow
1. Register new user → gets RENTER role → lands on `/renter/dashboard`
2. Browse rooms → click "Rent Now" on a rentable room
3. Select date → see hourly time slots
4. Book 1 hour slot → redirected to `/renter/payments` with 1hr countdown
5. Upload fake receipt → status: "Awaiting verification"
6. Login as manager → go to `/dashboard/rentals` → approve payment
7. Login as renter → see booking confirmed

---

## Checklist

### Phase 1: Fix Build Errors ✅ COMPLETED
- [x] Fix `/renter/bookings/page.tsx` JSX root
- [x] Fix `/renter/dashboard/page.tsx` JSX root
- [x] Fix `/renter/payments/page.tsx` JSX root
- [x] Fix `/renter/rooms/[id]/page.tsx` JSX root
- [x] Fix `/renter/chat/page.tsx` JSX root (completely rewritten)
- [x] Fix `/renter/rooms/page.tsx` Badge conflict (inline Badge removed)
- [x] Fix `RentalHold` type — `paymentId`, `date` instead of `holdDate`
- [x] Fix `BookingHold` frontend type — `status` values, `payment` relation
- [x] Fix `RentalSlot` frontend type — added `isActive`
- [x] Fix Select components in rentals dashboard — `options` prop
- [x] Fix `amenities` type in room detail — already `string[]`
- [x] Rebuild frontend Docker image ✅
- [x] Verify frontend starts successfully ✅ (running on port 3001)

### Phase 2: IT Admin Rental Config ✅ COMPLETED
- [x] Add `maxBookingHours Int?` field to Room model in Prisma schema
- [x] Run `prisma db push` (pushed schema to PostgreSQL)
- [x] Add `RentalSlot` CRUD endpoints (GET/POST/PATCH/DELETE /rentals/slots)
- [x] Add `maxBookingHours` field to UpdateRoomDto
- [x] Add admin UI — maxBookingHours input in room edit modal (shown when rentable)
- [x] Add Rentable column — shows max hours per room in table
- [x] Rebuild backend ✅ (new image built, container running)
- [x] Rebuild frontend ✅ (new image built, container running)

### Phase 3: Renter Booking Flow ✅ COMPLETED
- [x] 1-hour countdown timer in payment page — each pending payment shows live countdown bar + MM:SS
- [x] Auto-cancel expired BookingHold — `RentalsService.onModuleInit()` runs every 30s, sets EXPIRED + notification
- [x] Room photos on room detail page — `room.imageUrl` displayed in hero image area
- [x] Seed data — all 4 rooms marked `isRentable: true` + 180 `RentalSlot` entries (9am-6pm, Mon-Fri)

### Phase 4: Manager Payment Dashboard ✅ COMPLETED
- [x] `/dashboard/rentals/page.tsx` — booking holds list with approve/reject (fixed endpoint to `/rentals/holds`)
- [x] Payment approve/reject flow — backend `PaymentsService.approve/reject` + `paymentId` now linked to BookingHold
- [x] Chat dashboard `/dashboard/chat/page.tsx` — restored DashboardLayout, fixed `getOtherParticipantId` helper
- [x] `POST /chat/conversations` — create/get virtual conversation endpoint added
- [x] `POST /chat/mark-read/:participantId` — added to match frontend
- [x] Notification bell in Header — dropdown with unread count, mark-as-read, click-to-navigate

### Phase 5: Modification Requests ✅ COMPLETED
- [x] USER role restriction — `BookingsService.cancel()` throws 403 if `userRole === Role.USER`
- [x] "Request Cancellation" button (USER role) — shown instead of Cancel; opens modal with reason field
- [x] Cancellation requests submit to `POST /api/booking-change-requests` (no room/time changes)
- [x] Manager approve → cancels booking (no changes needed = cancellation request); sends in-app notification
- [x] Manager reject → sends in-app notification
- [x] `CHANGE_REQUEST_SUBMITTED` notification type added (managers notified when USER submits)
- [x] `NotificationsModule` imported into `BookingChangeRequestsModule` for in-app notifications

### Phase 6: End-to-End Testing ✅ COMPLETED
- [x] Seed rentable rooms + rental slots (4 rooms × 5 days × 9 slots = 180 entries)
- [x] Test full rental flow (register → browse → book → pay → manager approves) — PASSED
- [x] Verify notifications fire on booking events (PAYMENT_APPROVED, NEW_MESSAGE, etc.) — PASSED
- [x] Verify chat works between renter and manager — PASSED
- [x] Backend unit tests: **9/9 suites, 45/45 tests PASSED**
- [x] Frontend unit tests: **1/1 suite, 6/6 tests PASSED**

---

## File Locations
- **Backend**: `/home/ubuntu/roomflow/backend/`
- **Frontend**: `/home/ubuntu/roomflow/frontend/`
- **Prisma schema**: `/home/ubuntu/roomflow/backend/prisma/schema.prisma`
- **Docker compose**: `/home/ubuntu/roomflow/docker-compose.yml`

## Key API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rentals/available-rooms` | List rentable rooms |
| POST | `/api/rentals/booking-hold` | Create 1hr booking hold |
| GET | `/api/rentals/my-bookings` | Renter's bookings |
| POST | `/api/payments/upload` | Upload payment receipt |
| PATCH | `/api/payments/:id/approve` | Manager approves |
| PATCH | `/api/payments/:id/reject` | Manager rejects |
| GET | `/api/chat/conversations` | List conversations |
| POST | `/api/chat/send` | Send message |
| GET | `/api/notifications` | List notifications |
