'use client';

import React from 'react';
import { CheckCircle, Calendar, Clock, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  available: boolean;
}

interface BookingSummaryProps {
  selectedDate: string | null;
  selectedSlot: TimeSlot | null;
  roomName: string;
  onCreateHold: () => void;
  isLoading?: boolean;
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatTime = (isoString: string) => isoString.substring(11, 16);

const formatRupiah = (amount: number) =>
  'Rp ' + amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function BookingSummary({
  selectedDate,
  selectedSlot,
  roomName,
  onCreateHold,
  isLoading = false,
}: BookingSummaryProps) {
  const isReady = selectedDate && selectedSlot;

  return (
    <div className="space-y-4">
      <div className="border border-slate-900 glass rounded-lg p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-slate-900">Booking Summary</h3>
        </div>

        {/* Content */}
        {isReady ? (
          <div className="space-y-3">
            {/* Room */}
            <div className="flex justify-between items-start">
              <span className="text-sm text-slate-600">Room:</span>
              <span className="text-sm font-medium text-slate-900">{roomName}</span>
            </div>

            {/* Date */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>Date:</span>
              </div>
              <span className="text-sm font-medium text-slate-900">{formatDate(selectedDate)}</span>
            </div>

            {/* Time */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4" />
                <span>Time:</span>
              </div>
              <span className="text-sm font-medium text-slate-900">
                {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-200 my-2" />

            {/* Price */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <CreditCard className="w-4 h-4 text-indigo-500" />
                <span>Amount:</span>
              </div>
              <span className="text-lg font-bold text-indigo-600">{formatRupiah(selectedSlot.price)}</span>
            </div>

            {/* Note */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                ⏱️ Hold expires in 1 hour. Complete payment within this time to confirm your booking.
              </p>
            </div>

            {/* Create Hold Button */}
            <Button
              variant="primary"
              onClick={onCreateHold}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Creating Hold...' : 'Create Booking Hold'}
            </Button>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-500">
            <p className="text-sm">Select a date and time slot to see booking details</p>
          </div>
        )}
      </div>
    </div>
  );
}
