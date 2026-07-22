'use client';

import React from 'react';
import { ShoppingBag, CreditCard, X, Clock, Calendar, MapPin, Timer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BookingHold } from '@/types';

interface BookingBagProps {
  holds: BookingHold[];
  onPayAll: () => void;
  onCancelled: () => void;
}

const formatDate = (dateStr: string) =>
  new Date(dateStr.substring(0, 10) + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatTime = (isoString: string) => isoString.substring(11, 16);

const formatRupiah = (amount: number) =>
  'Rp ' + amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function BookingBag({ holds, onPayAll, onCancelled }: BookingBagProps) {
  const active = holds.filter((h) => h.status === 'ACTIVE');
  const total = active.reduce((sum, h) => sum + (h.price || 0), 0);

  const handleCancelOne = async (id: string) => {
    if (!confirm('Cancel this booking hold?')) return;
    try {
      await fetch(`/api/rentals/holds/${id}`, { method: 'DELETE' });
      onCancelled();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-slate-900 glass rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-slate-900">Booking Bag</h3>
          </div>
          {active.length > 0 && (
            <span className="text-xs font-bold bg-indigo-600 text-white rounded-full px-2 py-0.5">
              {active.length}
            </span>
          )}
        </div>

        {holds.length === 0 ? (
          <div className="py-6 text-center text-slate-500">
            <p className="text-sm">Your booking bag is empty. Pick a date and time slots to start.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {holds.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#f8f8f8] dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#3a3a3a]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {h.room?.name || 'Room'}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDate(h.holdDate)}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatTime(h.startTime)} - {formatTime(h.endTime)}
                    </p>
                    <p className="text-xs font-medium text-indigo-600">{formatRupiah(h.price)}</p>
                  </div>
                  <button
                    onClick={() => handleCancelOne(h.id)}
                    className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    aria-label="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 my-2" />

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <CreditCard className="w-4 h-4 text-indigo-500" />
                <span>Total:</span>
              </div>
              <span className="text-lg font-bold text-indigo-600">{formatRupiah(total)}</span>
            </div>

            <Button
              variant="primary"
              onClick={onPayAll}
              disabled={active.length === 0}
              className="w-full"
            >
              <CreditCard className="w-4 h-4" />
              Pay All ({active.length})
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
