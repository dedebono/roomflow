'use client';

import React from 'react';

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  available: boolean;
}

interface BookingSummaryProps {
  selectedDate: string;
  selectedSlot: TimeSlot | TimeSlot[] | null;
  roomName: string;
  onCreateHold: () => void;
  isLoading?: boolean;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const cleanDate = dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr;
  return new Date(cleanDate + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const formatTime = (isoString?: string) => {
  if (!isoString) return '--:--';
  return isoString.length >= 16 ? isoString.substring(11, 16) : isoString;
};

const formatRupiah = (amount: number) => {
  return 'Rp ' + amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export function BookingSummary({
  selectedDate,
  selectedSlot,
  roomName,
  onCreateHold,
  isLoading = false,
}: BookingSummaryProps) {
  // Safe array handling untuk single/multiple slots
  const slots: TimeSlot[] = Array.isArray(selectedSlot)
    ? selectedSlot
    : selectedSlot
      ? [selectedSlot]
      : [];

  const totalPrice = slots.reduce((sum, slot) => sum + (slot?.price || 0), 0);
  const isReady = Boolean(selectedDate && slots.length > 0);

  return (
    <div className="space-y-4">
      <div className="border border-slate-800 bg-slate-900/50 backdrop-blur rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-bold text-white">Ringkasan Pesanan</h3>

        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Ruangan:</span>
            <span className="font-medium text-white">{roomName || '-'}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Tanggal:</span>
            <span className="font-medium text-white">{formatDate(selectedDate)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Jam / Slot:</span>
            <div className="text-right font-medium text-white">
              {slots.length === 0 ? (
                <span className="text-slate-500">Belum dipilih</span>
              ) : (
                slots.map((s, idx) => (
                  <div key={s?.id || idx}>
                    {formatTime(s?.startTime)} - {formatTime(s?.endTime)}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3 flex justify-between items-center font-bold text-base">
          <span className="text-slate-300">Total Harga:</span>
          <span className="text-blue-400">{formatRupiah(totalPrice)}</span>
        </div>

        <button
          onClick={onCreateHold}
          disabled={!isReady || isLoading}
          className="w-full py-2.5 px-4 rounded-md font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Memproses...' : 'Lanjutkan Booking'}
        </button>
      </div>
    </div>
  );
}

export default BookingSummary;
