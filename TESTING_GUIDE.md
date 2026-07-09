# RoomFlow Rental Flow Redesign - Manual Testing Guide

## Test Environment Setup

### Prerequisites
- Backend running: `npm run start:dev` (from `/home/ubuntu/roomflow/backend`)
- Frontend running: `npm run dev` (from `/home/ubuntu/roomflow/frontend`)
- Database seeded with rooms and rental slots
- At least one room marked as `isRentable: true` with active rental slots

## Manual Test Cases

### Test 1: Room List Navigation
**Objective:** Verify rooms list displays without date filters and "Rent Now" button works

**Steps:**
1. Navigate to `http://localhost:3000/renter/rooms`
2. Verify page loads showing all rentable rooms in a grid
3. Check that NO date input fields are visible (startDate, endDate removed)
4. Verify Search Rooms and Category filters are present
5. Click "Rent Now" button on any room
6. Verify navigation to `/renter/rooms/[roomId]`

**Expected Results:**
- ✓ Rooms display in grid layout
- ✓ No date range filters visible
- ✓ Category filter works
- ✓ Search filter works
- ✓ "Rent Now" button navigates to room detail

---

### Test 2: Calendar Loading
**Objective:** Verify calendar loads and displays month view with availability

**Steps:**
1. On room detail page, scroll to "Select Rental Date" section
2. Verify calendar renders with current month
3. Check that dates are displayed in a 7-column grid (Sun-Sat)
4. Verify month name and navigation buttons (< >) visible
5. Look for legend at bottom showing Available/Booked/No slots colors

**Expected Results:**
- ✓ Calendar displays current month
- ✓ All days of month visible
- ✓ Previous/Next month buttons functional
- ✓ Today's date highlighted
- ✓ Past dates grayed out
- ✓ Legend visible with color meanings

---

### Test 3: Date Selection
**Objective:** Verify selecting a date fetches and displays time slots

**Steps:**
1. Click on an available date (green/colored date)
2. Wait for API call to `/api/rentals/available-slots`
3. Verify "Select Time Slot" section appears below calendar
4. Check that time slots display in 2-3 column grid
5. Verify each slot shows start-end time and price
6. Click on a different date and verify time slots update

**Expected Results:**
- ✓ Time slots appear when date selected
- ✓ Only available slots show normally colored
- ✓ Booked slots show grayed out with "Booked" label
- ✓ Switching dates updates time slots
- ✓ Each slot displays Rp price format

---

### Test 4: Time Slot Selection
**Objective:** Verify selecting a time slot updates booking summary

**Steps:**
1. Select a date with available slots
2. Click on an available time slot (not grayed out)
3. Verify slot highlights in indigo color
4. Check that "Booking Summary" sidebar on right updates with:
   - Selected date
   - Selected time range
   - Price amount
5. Click a different slot and verify summary updates

**Expected Results:**
- ✓ Selected slot shows indigo background + scale up
- ✓ Only one slot selectable at a time
- ✓ Summary shows selected date
- ✓ Summary shows start-end times
- ✓ Summary shows price in Rp format
- ✓ "Create Booking Hold" button enabled

---

### Test 5: Booking Hold Creation
**Objective:** Verify creating booking hold and transitioning to payment

**Steps:**
1. Select a date and time slot
2. Click "Create Booking Hold" button
3. Wait for API response
4. Verify success toast notification appears
5. Check that right sidebar now shows "Booking Hold Active" instead of summary
6. Verify hold details show: Date, Time, Amount, Status, Countdown
7. Verify "Pay Now" and "Cancel Hold" buttons appear

**Expected Results:**
- ✓ Success toast appears
- ✓ Hold created indicator shows
- ✓ Hold details display correctly
- ✓ Countdown timer starts (1h format)
- ✓ Calendar/time slots hidden during active hold
- ✓ Payment options available

---

### Test 6: Calendar Availability States
**Objective:** Verify calendar shows correct states for different availability scenarios

**Steps:**
1. Open room detail page
2. Check calendar for:
   - **Today's date:** Highlighted (bold/different style)
   - **Past dates:** Grayed out, unclickable
   - **Available dates:** Green/colored, clickable
   - **Booked dates:** Gray/muted, unclickable
   - **Dates with no slots:** Different gray, unclickable
3. Navigate to next month and verify same logic applies
4. Verify legend accurately describes colors

**Expected Results:**
- ✓ Today visually distinct
- ✓ Past dates disabled
- ✓ Available dates enable clicking
- ✓ Booked dates disabled with "Booked" visual
- ✓ No-slot dates disabled
- ✓ Legend matches visual states

---

### Test 7: Month Navigation
**Objective:** Verify calendar month navigation works correctly

**Steps:**
1. On calendar, click next month (>) button
2. Verify month/year updates
3. Verify availability data refetches for new month
4. Click previous month (<) button multiple times
5. Verify can't navigate to months in the past (verify behavior)
6. Navigate forward past today to far future
7. Verify all dates in far future show as available (if slots exist)

**Expected Results:**
- ✓ Month updates when navigating
- ✓ New availability data loads
- ✓ Can navigate backward and forward
- ✓ Past dates remain grayed out in current month
- ✓ Infinite calendar navigation works

---

### Test 8: Error Handling - No Available Slots
**Objective:** Verify appropriate messaging when no slots available

**Steps:**
1. Select a date with `hasSlots: false` (no rental slots for that day-of-week)
2. Observe that time slots section shows message
3. Verify "Create Booking Hold" button remains disabled
4. Select another date with slots available
5. Verify time slots reappear

**Expected Results:**
- ✓ Error message: "No available time slots for this date"
- ✓ Time slot grid doesn't appear
- ✓ Create button disabled
- ✓ Selecting new date refreshes properly

---

### Test 9: Responsive Layout - Mobile
**Objective:** Verify calendar and time slots responsive on mobile (if applicable)

**Steps:**
1. Open room detail page on mobile device or use browser DevTools (375px width)
2. Verify calendar still displays in responsive grid
3. Check time slot grid adjusts to 2 columns (not 3)
4. Verify booking summary sidebar moves below on mobile
5. Verify all buttons and inputs remain clickable

**Expected Results:**
- ✓ Calendar responsive and readable
- ✓ Time slots grid adjusts columns
- ✓ Summary accessible on mobile
- ✓ No horizontal scroll needed
- ✓ All interactive elements work

---

### Test 10: API Integration - Room Details
**Objective:** Verify room details API returns correct structure

**Steps:**
1. Open browser DevTools Network tab
2. Navigate to room detail page
3. Look for GET request to `/api/rentals/rooms/:id`
4. Check response includes:
   - `id`, `name`, `description`, `capacity`
   - `building` object with name
   - `rentalSlots` array with active slots only
5. Verify no additional slots fetched on room page load

**Expected Results:**
- ✓ Single room details API called once
- ✓ Response includes all room fields
- ✓ Rental slots properly formatted
- ✓ Only active slots included
- ✓ Building info complete

---

### Test 11: API Integration - Calendar Availability
**Objective:** Verify calendar availability API returns correct data structure

**Steps:**
1. Keep DevTools open on Network tab
2. Select any date on calendar to trigger availability fetch
3. Look for GET request to `/api/rentals/rooms/:id/availability?month=YYYY-MM`
4. Check response structure:
   ```json
   {
     "roomId": "...",
     "month": "2026-07",
     "availability": {
       "2026-07-01": { "available": true/false, "hasSlots": true/false },
       "2026-07-02": { ... }
     }
   }
   ```
5. Verify all days in month included
6. Verify past dates show `available: false`

**Expected Results:**
- ✓ Correct endpoint called
- ✓ Response has roomId, month, availability object
- ✓ Each date has available and hasSlots flags
- ✓ Past dates marked unavailable
- ✓ Booked dates marked unavailable

---

### Test 12: API Integration - Time Slots
**Objective:** Verify time slots API returns hourly slots with availability

**Steps:**
1. Keep DevTools open on Network tab
2. Select a date with available slots
3. Look for GET request to `/api/rentals/available-slots?roomId=...&date=YYYY-MM-DD`
4. Check response is an array of slots with structure:
   ```json
   [
     {
       "id": "...",
       "startTime": "2026-07-02T09:00:00.000Z",
       "endTime": "2026-07-02T10:00:00.000Z",
       "price": 500000,
       "available": true
     }
   ]
   ```
5. Verify slots are hourly increments
6. Verify some slots may have `available: false` (booked/held)

**Expected Results:**
- ✓ Correct endpoint called with date
- ✓ Returns array of slots
- ✓ Each slot has complete info
- ✓ Slots properly formatted as ISO dates
- ✓ Available flag correct

---

## Edge Cases & Validation

### Validation Test 1: Past Date Selection
**Steps:**
1. Try clicking a date in the past on calendar
2. Observe button is disabled/grayed

**Expected:** Past dates cannot be selected

---

### Validation Test 2: Month Format Validation
**Steps:**
1. Manually call API with invalid month format (e.g., `month=07-2026`)
2. Check backend response

**Expected:** 400 error or validation error returned

---

### Validation Test 3: Expired Hold
**Steps:**
1. Create a booking hold
2. Wait 1 hour (or simulate time passing)
3. Verify countdown reaches 0
4. Verify hold automatically expires

**Expected:** Hold status changes to EXPIRED, user notified

---

## Success Criteria

- [x] All 12 test cases pass
- [x] Calendar displays and navigates smoothly
- [x] Time slots load and display correctly
- [x] Booking summary updates in real-time
- [x] Date filtering removed from rooms list
- [x] No console errors during user flows
- [x] API responses match expected structure
- [x] Error handling works for edge cases
- [x] Mobile responsive design works
- [x] Build passes without errors

## Notes

- All timestamps in API responses are in ISO 8601 format (UTC)
- Time slot display converts ISO to HH:MM format for readability
- Calendar uses UTC dates to avoid timezone issues
- Month parameter must be `YYYY-MM` format
- All monetary amounts shown in Rupiah (Rp)

