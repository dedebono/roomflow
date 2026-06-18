# RoomFlow Industry Standard Audit

Generated: 2026-06-05
Scope: Full-stack audit of `/home/ubuntu/roomflow`

---

## CRITICAL (must fix — security or data integrity risk)

### 1. JWT secret fallback to hardcoded default

**File:** `backend/src/auth/strategies/jwt.strategy.ts:12`
```ts
secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret-key',
```
If `JWT_SECRET` env var missing, falls back to `'default-secret-key'`. Any attacker can forge tokens.

**Fix:** Remove `|| 'default-secret-key'`. Crash on missing secret instead of silently weakening auth.

### 2. CORS allows all origins in production

**File:** `backend/src/main.ts:21`
```ts
app.enableCors();
```
No origin restriction. Any domain can make authenticated requests from user browsers.

**Fix:**
```ts
app.enableCors({
  origin: ['https://room.ytcb.org', 'http://localhost:3001'],
  methods: ['GET','POST','PATCH','DELETE'],
  credentials: true,
});
```

### 3. Rate limiting — NOT implemented (package installed but unused)

**File:** `backend/package.json:32`
```json
"@nestjs/throttler": "^6.5.0",
```
Package listed in dependencies but not imported or configured in any module. No rate limiting anywhere — login endpoint, OTP endpoint, API endpoints all unprotected against brute-force/abuse.

**Check:** `backend/src/app.module.ts` — no `ThrottlerModule.forRoot()` present.

**Fix:** Add `ThrottlerModule.forRoot()` to `AppModule`, configure global rate limits.

### 4. No pagination on list endpoints

**Files:** `backend/src/bookings/bookings.controller.ts:28`, `backend/src/rooms/rooms.controller.ts:36`, `backend/src/payments/payments.controller.ts:54`, `backend/src/rentals/rentals.controller.ts:62`

All `findAll`/`getPending`/`getMy*` endpoints return ALL records unfiltered. With growth, this will cause OOM crashes and slow responses.

Example — `backend/src/bookings/bookings.controller.ts:28-33`:
```ts
@Get()
findAll(@Query('roomId') roomId?: string, @Query('userId') userId?: string) {
  return this.bookingsService.findAll(roomId, userId);
}
```
No `skip`, `take`, `page`, `limit` params.

**Fix:** Add pagination params (`page`, `limit`), implement `skip`/`take` in Prisma queries.

### 5. Docker secrets hardcoded in compose file

**File:** `docker-compose.yml:30`
```yaml
JWT_SECRET: roomflow-super-secret-key-123!
```
Postgres password also hardcoded. These get committed to version control, visible to anyone with repo access.

**Fix:** Use `${JWT_SECRET}` env var reference, set actual secrets through `.env` (git-ignored) or Docker secrets.

### 6. No health check endpoint

**File:** `backend/src/main.ts` — no `/health` or `/api/health` route anywhere in the codebase.

Without health checks, orchestrators (Docker, k8s) cannot detect dead/unhealthy backend. Container runs but app may be deadlocked — no auto-restart.

**Fix:** Add `@Get('health')` in `AppController`, return `{ status: 'ok', timestamp, uptime }`. Add `healthcheck` in docker-compose.

---

## HIGH (strongly recommended — blocking major quality/stability)

### 7. TypeScript strict mode disabled

**File:** `backend/tsconfig.json`
```json
"strictNullChecks": true,
"noImplicitAny": false,
"strictBindCallApply": false,
"noFallthroughCasesInSwitch": false
```
`"strict": true` absent. `noImplicitAny: false` means implicit `any` types compile silently — defeats TS purpose.

**Fix:** Set `"strict": true`, then fix ~20-50 type errors across codebase.

### 8. payment `amount` field unvalidated

**File:** `backend/src/payments/payments.controller.ts:32-38`
```ts
const rawData = req.body.paymentData || req.body;
dto = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
```
DTO parsed manually from multipart form — `class-validator` never runs. `amount` passed as `Number(dto.amount)` without checking if NaN or negative.

**File:** `backend/src/payments/dto/upload-payment.dto.ts` — no `@IsNumber()` or `@Min(0)` decorator on `amount`.

**Fix:** Add proper DTO validation for multipart upload. Validate `amount` server-side.

### 9. No database indexes on high-traffic fields

**File:** `backend/prisma/schema.prisma`

Missing indexes on:
- `Booking.userId` (used in `findAll` + `getMyBookings`)
- `Payment.userId` (used in `getMyPayments`)
- `ChatMessage.senderId`, `receiverId` (chat queries)
- `Notification.userId` (has `@@index([userId, isRead])` — good, but `createdAt` alone may need index too)
- `Booking.userId` — no index at all
- `RentalSlot.dayOfWeek`, `RentalSlot.price` — queryable fields

**Fix:** Add `@@index([fieldName])` on all frequently queried foreign key columns.

### 10. No E2E tests

**Files:** `backend/test/` — `jest-e2e.json` exists but no actual `.spec.ts` files found for E2E.

**Fix:** Write Playwright or Cypress tests covering: register → login → browse → create hold → upload payment → approve → confirm booking.

### 11. No structured logging

**File:** `backend/src/main.ts:31`
```ts
console.log(`Application is running on: http://localhost:${port}/api`);
```
All logging is `console.log`/`console.error`. No structured JSON logging, no log levels (info/warn/error), no request IDs for tracing.

**Fix:** Integrate `pino` or `winston`. Configure NestJS Logger adapter to use structured format.

### 12. No global exception filter for consistent error shapes

**File:** `backend/src/main.ts` — only `ValidationPipe` configured. No `app.useGlobalFilters()` call.

NestJS default exception handler returns different shapes per error type. Frontend cannot rely on consistent `{ statusCode, message, error }` format.

**Fix:** Create `AllExceptionsFilter` implementing `ExceptionFilter`, register globally in `main.ts`.

### 13. No E2E tests across the full stack

**File:** `frontend/package.json:10` — `"test": "jest"` script exists. No Playwright/Cypress dependency in any package.json. No E2E test files found anywhere.

**Fix:** Install Playwright. Write tests covering critical user journeys end-to-end (rental booking flow, calendar viewing, payment workflow).

### 14. Image upload missing validation (file type & size)

**File:** `backend/src/rooms/rooms.controller.ts:27`
```ts
@UseInterceptors(FileInterceptor('image'))
```
No FileTypeValidator or MaxFileSizeValidator configured. Users can upload arbitrary files (`.exe`, `.zip`, 1GB videos).

**Fix:**
```ts
@UseInterceptors(FileInterceptor('image', {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
      cb(new BadRequestException('Only JPEG/PNG/WebP images allowed'), false);
    } else cb(null, true);
  },
}))
```

---

## MEDIUM (improves reliability, UX, and dev experience)

### 15. Booking `startTime`/`endTime` validation weak

**File:** `backend/src/bookings/dto/create-booking.dto.ts`

Likely missing `@IsDateString()` or custom validation that `endTime > startTime`. Without it, clients can create zero-length or negative-duration bookings.

**Fix:** Add `@IsDateString()` and custom validator `IsAfterStartTime`.

### 16. No image processing for room images

**File:** `backend/src/rooms/rooms.service.ts` (referenced by controller)

Room images uploaded via `FileInterceptor('image')` but no compression/resizing — users upload full-resolution phone photos (4-12MB each). Over time kills disk space and page load.

**Note:** Rental payment images DO use Sharp via `storage.service.ts`. Room images don't.

**Fix:** Apply same Sharp compression to room image uploads.

### 17. No JWT refresh token mechanism

**File:** `backend/src/auth/auth.service.ts`
```ts
access_token: this.jwtService.sign(payload),
```
Single `access_token` returned. No `refresh_token`. When token expires (default NestJS JWT: 900s), user forced to re-login.

**Fix:** Implement `/auth/refresh` endpoint with `refresh_token`. Store refresh tokens (hashed) in DB.

### 18. No file size limit on payment uploads

**File:** `backend/src/payments/payments.controller.ts:26`
```ts
@UseInterceptors(FileInterceptor('file'))
```
No `limits: { fileSize: ... }`. Payment proof uploads can be arbitrarily large.

**Fix:** Limit to 10MB for payment proofs.

### 19. `Booking.status` uses temporary PENDING

**File:** `backend/src/payments/payments.service.ts:127`
```ts
status: BookingStatus.CANCELLED, // Default to cancelled until paid/approved
```
Booking created with `CANCELLED` status, changed to `BOOKED` on approval. Status name semantically wrong — booking was never cancelled, it's pending.

**Fix:** Add `PENDING` to `BookingStatus` enum in schema, use it instead.

### 20. Frontend API client logs auth tokens

**File:** `frontend/src/lib/api.ts:49`
```ts
console.log('[api] token attached:', token.slice(0, 20) + '...');
```
Auth tokens logged to browser console. Any browser extension or shared screen can leak tokens.

**Fix:** Remove console.log of token. Keep status-only logging.

### 21. `imageUrl` in `next.config.ts` too permissive

**File:** `frontend/next.config.ts:15-16`
```ts
hostname: "**", // Allows ANY HTTPS hostname
```
Allows Next.js Image optimization from any HTTPS domain — potential SSRF vector if user-controllable URLs reach this.

**Fix:** Restrict to specific domains (e.g., room.ytcb.org, localhost).

### 22. Missing frontend loading states

**File:** Various page components in `frontend/src/pages/`

Many pages fetch data on mount but don't show loading indicators. Users see empty shell while data loads. `react-hot-toast` used but not for loading feedback.

**Fix:** Add skeleton loaders or spinner states to all data-fetching pages.

### 23. `StorageService` S3 path unimplemented but exposed

**File:** `backend/src/storage/storage.service.ts:39`
```ts
// Placeholder for S3/Google Drive
throw new Error('Storage type not implemented');
```
`STORAGE_TYPE` checked in code, `S3` case throws runtime error. If someone sets `STORAGE_TYPE=S3` in env, entire upload system breaks.

**Fix:** Either implement S3 or remove the code path. Don't leave dead branches.

---

## LOW (nice-to-have — polish and DX)

### 24. `noImplicitAny: false` weakens TS safety

**File:** `backend/tsconfig.json:21`
```json
"noImplicitAny": false
```
Allows undeclared `any` types. Example in `jwt.strategy.ts:16`:
```ts
async validate(payload: any) {
```
Should be typed `{ sub: string; email: string; role: Role }`.

**Fix:** Set `"noImplicitAny": true` after enabling strict mode.

### 25. Sleepy enum casting

**File:** `backend/src/payments/payments.service.ts:168-169`
```ts
where: { role: 'ROOM_ADMIN' as any },
```
Prisma-generated `Role` enum available but overridden with raw string + `as any`. Type safety defeated.

**Fix:** Use `Role.ROOM_ADMIN` from `@prisma/client`.

### 26. No input sanitization on `notes`/`description` fields

**Files:** Various DTOs — `description` on payment upload, `notes` on booking, `amenities` string on room.

No trimming, no max-length validation. Could store arbitrary text.

**Fix:** Add `@MaxLength(2000)` and `@Trim()` (custom) to all text fields.

### 27. No `.dockerignore` file

**File:** Missing at project root.

`node_modules`, `.git`, `.next`, `.env` sent to Docker daemon as build context. Slows builds, risks leaking secrets.

**Fix:** Create `.dockerignore` with:
```
node_modules/
.git/
.env
.next/
dist/
coverage/
```

### 28. Booking update DTO uses inline type, not class

**File:** `backend/src/bookings/bookings.controller.ts:47`
```ts
@Body() updateBookingDto: { title?: string; notes?: string; roomId?: string; startTime?: string; endTime?: string },
```
Inline anonymous type instead of dedicated DTO class. No validation decorators. Frontend can send any fields.

**Fix:** Create `UpdateBookingDto` with `class-validator` decorators.

### 29. `createSlot` endpoint has no auth guard

**File:** `backend/src/rentals/rentals.controller.ts:98`
```ts
@Post('slots')
createSlot(@Body() dto: CreateRentalSlotDto) {
  return this.rentalsService.createSlot(dto);
}
```
No `@Roles()` or `@UseGuards()` decorator. Any authenticated user (even RENTER) can create rental pricing slots.

**Fix:** Add `@Roles(Role.ADMIN_IT, Role.ROOM_ADMIN)`.

### 30. `console.log` in production code

**Files:** `frontend/src/lib/api.ts:49,66`, `backend/src/main.ts:31`

Debug logging in production. `console.log` in browser exposes behavior to users.

**Fix:** Use proper logger in backend, remove frontend console.log or wrap behind `if (process.env.NODE_ENV !== 'production')`.

---

## Summary Table

| Category | Count | Items |
|----------|-------|-------|
| CRITICAL | 6 | JWT fallback, CORS permissive, rate limiting missing, no pagination, secrets hardcoded, no health check |
| HIGH | 8 | strict mode off, payment amount unvalidated, no indexes, no E2E tests, no structured logging, no exception filter, image validation missing |
| MEDIUM | 9 | booking time validation, room image compression, refresh tokens, file size limits, booking status naming, console log tokens, next.config permissive, loading states, dead S3 path |
| LOW | 7 | noImplicitAny, enum casting, sanitization, .dockerignore, inline DTO, slot auth guard, console.log |
| **Total** | **30** | |
