# RoomFlow Rental Flow Redesign - Technical Implementation Details

## Architecture Overview

### User Flow (Before → After)

**Before:**
```
/renter/rooms (with date filters)
    ↓ [Select date range + category]
    ↓ [View filtered rooms with availability]
    ↓ "Rent Now"
    ↓ /renter/rooms/[id] (static room details)
    ↓ Manual date/time input
```

**After:**
```
/renter/rooms (all rooms, no date filters)
    ↓ "Rent Now"
    ↓ /renter/rooms/[id] with calendar
    ↓ [Select date on calendar]
    ↓ [Time slots load for selected date]
    ↓ [Select time slot]
    ↓ [Booking summary updates]
    ↓ "Create Booking Hold"
    ↓ Payment flow
```

## Backend Implementation Details

### New Service Methods

#### 1. `getRoomDetails(roomId: string)`
**Purpose:** Fetch single room with all rental-related data
**Location:** `rentals.service.ts:676-695`

**Logic:**
- Fetch room by ID with building and active rental slots
- Include all slot information (dayOfWeek, startTime, endTime, price)
- Order slots by dayOfWeek and startTime
- Throw NotFoundException if room not found or not rentable

**Response Structure:**
```typescript
{
  id: string;
  name: string;
  description: string;
  capacity: number;
  category: string;
  isRentable: boolean;
  building: { id: string; name: string };
  rentalSlots: [{
    id: string;
    dayOfWeek: number; // 1-7 (Mon-Sun)
    startTime: string; // "09:00"
    endTime: string;   // "17:00"
    price: number;     // 500000
    isActive: boolean;
  }];
}
```

#### 2. `getRoomAvailability(roomId: string, month: string)`
**Purpose:** Calculate day-level availability for entire month
**Location:** `rentals.service.ts:697-789`

**Logic:**
1. Parse month string as YYYY-MM format
2. Fetch room with active rental slots
3. For each day in month:
   - Check if date is past (mark unavailable)
   - Check if day-of-week has rental slots defined
   - Check for booking conflicts (status: BOOKED)
   - Check for active hold conflicts (status: ACTIVE)
   - Mark available only if no conflicts and has slots
4. Return availability map keyed by date string

**Availability Determination:**
- **Date is past:** `available: false, hasSlots: false`
- **No slots for day-of-week:** `available: false, hasSlots: false`
- **Has slots, no conflicts:** `available: true, hasSlots: true`
- **Has slots, full-day conflict:** `available: false, hasSlots: true`

**Response Structure:**
```typescript
{
  roomId: string;
  month: string; // "2026-07"
  availability: {
    "2026-07-01": { available: boolean; hasSlots: boolean },
    "2026-07-02": { available: boolean; hasSlots: boolean },
    // ... all days in month
  }
}
```

### New Endpoints

#### GET `/api/rentals/rooms/:id`
- **Route:** `@Get('rooms/:id')`
- **Auth:** Public (no auth required)
- **Calls:** `rentalsService.getRoomDetails(roomId)`
- **Error Handling:** Returns 404 if room not found or not rentable

#### GET `/api/rentals/rooms/:id/availability?month=YYYY-MM`
- **Route:** `@Get('rooms/:id/availability')`
- **Auth:** Public (no auth required)
- **Query Params:** `month` (required, format: YYYY-MM)
- **Calls:** `rentalsService.getRoomAvailability(roomId, month)`
- **Error Handling:** Returns 400 if month format invalid, 404 if room not found

### Existing Endpoints (Unchanged but Used)

#### GET `/api/rentals/available-slots?roomId=...&date=YYYY-MM-DD`
- Returns hourly time slots for specific date
- Already existed, no changes needed
- Frontend calls this after date selection

## Frontend Implementation Details

### Components Architecture

```
/renter/rooms/[id]/page.tsx (Main Page)
├── RoomCalendar
│   ├── Fetches: GET /api/rentals/rooms/:id/availability?month=YYYY-MM
│   ├── State: currentMonth, availability, loading
│   └── Callback: onDateSelect(date)
├── TimeSlotSelector
│   ├── Input: slots[], selectedSlot, onSlotSelect
│   ├── Fetches: Already fetched by parent
│   └── Callback: onSlotSelect(slot)
└── BookingSummary
    ├── Input: selectedDate, selectedSlot, roomName
    ├── Callback: onCreateHold()
    └── Displays: Summary or "Select date and time" message
```

### RoomCalendar Component

**File:** `/home/ubuntu/roomflow/frontend/src/components/rental/RoomCalendar.tsx`

**Features:**
- Monthly calendar grid (7 columns for days of week)
- Previous/Next month navigation
- Color-coded date states (Available, Booked, No slots, Past)
- Responsive design (2-7 column grid)
- Legend explaining color meanings
- Loads availability data via fetch API

**State Management:**
```typescript
const [currentMonth, setCurrentMonth] = useState(new Date());
const [availability, setAvailability] = useState<Record<string, any>>({});
const [loading, setLoading] = useState(false);
```

**Key Logic:**
- Fetch triggered by: `monthKey` (YYYY-MM) or `roomId` changes
- Date format: `YYYY-MM-DD` for display and selection
- Day-of-week calculation uses UTC: `((date.getUTCDay() + 6) % 7) + 1`
- Today's date highlighted with bold styling
- Past dates automatically disabled

**Color Scheme:**
- **Available:** `bg-emerald-50 border-emerald-200` (green)
- **Booked:** `bg-slate-50 border-slate-200` (gray)
- **No Slots:** `bg-white border-slate-100` (light gray)
- **Selected:** `bg-indigo-600 border-indigo-400` (indigo)

### TimeSlotSelector Component

**File:** `/home/ubuntu/roomflow/frontend/src/components/rental/TimeSlotSelector.tsx`

**Features:**
- Grid display of hourly slots (2-3 columns responsive)
- Shows start-end time and price for each slot
- Visual distinction between available and booked
- Selection highlighting with scale effect
- Loading state with spinner

**Props:**
```typescript
interface TimeSlotselectorProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSlotSelect: (slot: TimeSlot) => void;
  loading?: boolean;
}
```

**Time Formatting:**
- ISO Input: `"2026-07-02T09:00:00.000Z"`
- Display: `"09:00"` (extracted substring 11-16)

**States:**
- **Available (not selected):** `bg-slate-100/40 border-slate-300/50`
- **Available (selected):** `bg-indigo-600 border-indigo-400 scale-105`
- **Booked/Unavailable:** `bg-white/40 opacity-60 line-through`

### BookingSummary Component

**File:** `/home/ubuntu/roomflow/frontend/src/components/rental/BookingSummary.tsx`

**Features:**
- Shows selected date, time, and price
- "Create Booking Hold" button (enabled only when both date+time selected)
- 1-hour expiration notice
- Disabled state when data incomplete

**Props:**
```typescript
interface BookingSummaryProps {
  selectedDate: string | null;
  selectedSlot: TimeSlot | null;
  roomName: string;
  onCreateHold: () => void;
  isLoading?: boolean;
}
```

**Display Logic:**
- Shows empty state if date OR slot missing
- Shows full summary only when BOTH date and slot selected
- Button disabled during API call (`isLoading: true`)

### Room Detail Page Integration

**File:** `/home/ubuntu/roomflow/frontend/src/app/renter/rooms/[id]/page.tsx`

**Layout Grid:**
```
Grid (2 columns on lg, 1 on mobile)
├── Left Column (lg:col-span-2)
│   ├── Room Image Card
│   ├── Room Info Card
│   └── Calendar + Time Slots (conditional)
└── Right Column
    └── Booking Summary OR Hold Status
```

**State Management:**
```typescript
const [selectedDate, setSelectedDate] = useState<string>('');
const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
const [loadingSlots, setLoadingSlots] = useState(false);
```

**Flow:**
1. Component mounts → fetch room details + active hold
2. User selects date → fetch time slots for that date
3. User selects slot → update local state (no API call)
4. User clicks "Create Hold" → POST to `/api/rentals/create-hold`
5. Success → Show active hold in sidebar, hide calendar

## Data Flow Diagram

```
User Interaction → Frontend State Update → Component Re-render

[Click Date]
  ↓
selectedDate = "2026-07-05"
  ↓
fetchTimeSlots("2026-07-05")
  ↓
GET /api/rentals/available-slots?roomId=...&date=2026-07-05
  ↓
setTimeSlots(response)
  ↓
<TimeSlotSelector slots={timeSlots} />
  ↓
[Click Slot]
  ↓
selectedSlot = slot object
  ↓
<BookingSummary selectedSlot={selectedSlot} />
  ↓
[Click "Create Hold"]
  ↓
handleCreateHold()
  ↓
POST /api/rentals/create-hold
  ↓
setActiveHold(response)
  ↓
<Booking Hold Active> (calendar hidden)
```

## Validation & Error Handling

### Backend Validation

**In getRoomAvailability:**
```typescript
if (!/^\d{4}-\d{2}$/.test(month)) {
  throw new Error('Month must be in format YYYY-MM');
}
```

**In getRoomDetails:**
```typescript
if (!room || !room.isRentable) {
  throw new NotFoundException('Room not found or not rentable');
}
```

**Existing validations used:**
- `checkAvailability()` - Checks date/time conflicts
- `createHold()` - Validates availability before creating hold

### Frontend Validation

**Date Selection:**
```typescript
<input type="date" min={today} /> // Blocks past dates in HTML5
```

**Time Slot Selection:**
```typescript
onClick={() => !isDisabled && onSlotSelect(slot)}
```

**Booking Ready Check:**
```typescript
const isReady = selectedDate && selectedSlot;
```

### Error Handling

**Toast Notifications:**
- Failed to load room: `toast.error('Failed to load room details')`
- Failed to load slots: `toast.error('Failed to load available time slots')`
- Failed to create hold: `toast.error(error.message)`

**Network Errors:**
```typescript
try {
  const res = await api.get(...);
} catch (err) {
  toast.error('Failed to...');
}
```

## Performance Considerations

### Optimization Points

1. **Calendar Availability Fetching:**
   - Fetches only when month changes
   - Uses `useEffect` dependency on `monthKey`
   - Lazy loads month by month (not full year)

2. **Time Slot Fetching:**
   - Only fetches when date selected
   - No caching (fresh data each time)
   - Could be optimized with React Query in future

3. **Component Rendering:**
   - Components memoized if needed (no current issues)
   - Calendar grid is 31 max cells (minimal render)
   - Time slots typically 8-10 slots per day

### Database Queries

**getRoomAvailability:**
- Single room fetch with slots: 1 query
- Per day: bookings.findFirst + bookings.findFirst
- Total: ~60 queries for 30-day month (optimizable with aggregation)

**getRoomDetails:**
- Single room fetch with building + slots: 1 query

**getAvailableSlots (existing):**
- Get slots + bookings + holds: 3 queries

## Security Considerations

### Authentication
- `/renter/rooms` - Requires auth (renter role)
- `/renter/rooms/[id]` - Requires auth (renter role)
- `/api/rentals/rooms/:id` - Public (for unauthenticated browsing)
- `/api/rentals/rooms/:id/availability` - Public
- `/api/rentals/available-slots` - Public
- `/api/rentals/create-hold` - Requires auth (uses CurrentUser decorator)

### Data Protection
- Room details fetched per room (no batch leak)
- Availability calculated per month (not year)
- No sensitive user data in availability response
- Booking holds tied to userId via @CurrentUser decorator

## Future Enhancements

1. **Caching:** Add Redis caching for monthly availability
2. **Performance:** Use aggregation queries for conflict detection
3. **UX:** Add time zone support for international users
4. **Features:** Add bulk date selection (date range picker)
5. **Analytics:** Track which dates/times are most popular
6. **Admin:** Add admin override for availability conflicts

