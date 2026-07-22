-- Migration: add_booking_hold_ids_to_payment
-- Applied manually to production DB
-- Links a single (batch) payment to multiple booking holds so a renter
-- can pay for several time slots in one transaction.

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "bookingHoldIds" TEXT[] NOT NULL DEFAULT '{}';
