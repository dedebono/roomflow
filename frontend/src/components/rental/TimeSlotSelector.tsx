'use client';

import React from 'react';
import { Clock } from 'lucide-react';

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  available: boolean;
}

interface TimeSlotselectorProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot[];
  onSlotSelect: (slot: TimeSlot) => void;
  loading?: boolean;
}

const formatTime = (isoString: string) => isoString.substring(11, 16);
const formatRupiah = (amount: number) =>
  'Rp ' + amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function TimeSlotSelector({
  slots,
  selectedSlots,
  onSlotSelect,
  loading = false,
}: TimeSlotselectorProps) {
  if (loading) {
    return (
      <div className="text-center py-8 text-slate-500">
        <div className="animate-spin inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full mb-2" />
        <p className="text-sm">Loading time slots...</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="p-4 bg-[#f7b917]/10 border border-[#f7b917]/30 rounded-lg">
        <p className="text-sm font-semibold text-[#143258] dark:text-[#e8e8e8]">No available time slots for this date.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-600 tracking-wide uppercase">Available Time Slots</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {slots.map((slot) => {
          const isDisabled = !slot.available;
          const isSelected = selectedSlots.some(
            (selected) => selected.id === slot.id
            );

          return (
            <button
              key={slot.id}
              onClick={() => !isDisabled && onSlotSelect(slot)}
              disabled={isDisabled}
              className={`p-3 rounded-xl text-sm font-bold transition-all border-2 flex flex-col items-center justify-center gap-1 ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30 scale-105'
                  : isDisabled
                  ? 'bg-white/40 border-slate-200 text-slate-600 cursor-not-allowed opacity-60 line-through'
                  : 'bg-[#f8f8f8] dark:bg-[#2a2a2a] border border-slate-300 dark:border-[#3a3a3a] text-[#143258] dark:text-[#e8e8e8] hover:border-indigo-500/50 dark:hover:border-indigo-400 hover:bg-slate-100 dark:hover:bg-[#3a3a3a] hover:scale-[1.02]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-200' : 'text-indigo-400'}`} />
                <span>
                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                </span>
              </div>
              <div className={`text-xs font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                {formatRupiah(slot.price)}
              </div>
              {isDisabled && <div className="mt-1 text-[10px] uppercase font-bold text-rose-500/80">Booked</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
