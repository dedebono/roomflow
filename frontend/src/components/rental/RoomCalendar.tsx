'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CalendarDay {
  date: string;
  available: boolean;
  hasSlots: boolean;
  dayOfMonth: number;
  isToday: boolean;
  isPast: boolean;
}

interface RoomCalendarProps {
  roomId: string;
  onDateSelect: (date: string) => void;
  selectedDate: string | null;
}

function computeCalendarDays(monthKey: string, availability: Record<string, any>): CalendarDay[] {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;

  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const daysInMonth = lastDay.getUTCDate();
  // ponytail: use local getDay() for calendar starting position — aligns headers with UTC+7 local day labels
  const startingDayOfWeek = new Date(year, month, 1).getDay();

  const today = new Date();
  // ponytail: uses local date string for cross-timezone consistency with backend UTC date comparison
  const todayLocalStr = today.toLocaleDateString('en-CA'); // "2026-07-05" in local TZ

  const result: CalendarDay[] = [];
  
  for (let i = 0; i < startingDayOfWeek; i++) {
    result.push({ date: '', available: false, hasSlots: false, dayOfMonth: 0, isToday: false, isPast: true });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(Date.UTC(year, month, day));
    const isToday = dateStr === todayLocalStr;
    const isPast = dateStr < todayLocalStr;
    const dayAvailability = availability[dateStr] || { available: false, hasSlots: false };
    
    result.push({
      date: dateStr,
      available: dayAvailability.available && !isPast,
      hasSlots: dayAvailability.hasSlots,
      dayOfMonth: day,
      isToday,
      isPast,
    });
  }

  return result;
}

export function RoomCalendar({ roomId, onDateSelect, selectedDate }: RoomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  });
  const [availability, setAvailability] = useState<Record<string, any>>({});
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  
  const monthKey = `${currentMonth.getUTCFullYear()}-${String(currentMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  
  // Fetch availability — cache-bust via localStorage version + SW unregister + ?v= query
  useEffect(() => {
    // Clear any stale localStorage booking data from previous app versions
    const CACHE_VER = 'v3';
    const prev = localStorage.getItem('rf_cal_ver');
    if (prev && prev !== CACHE_VER) {
      localStorage.removeItem('booking_selected_date');
      localStorage.removeItem('booking_selected_slots');
      console.log('[RoomCalendar] Cache cleared (version changed:', prev, '->', CACHE_VER, ')');
    }
    localStorage.setItem('rf_cal_ver', CACHE_VER);

    // Unregister any stale service workers that may cache API responses
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
    }

    let cancelled = false;
    setLoading(true);
    
    const apiUrl = `https://room.ytcb.org/api/rentals/rooms/${roomId}/availability?month=${monthKey}&v=${CACHE_VER}`;
    
    fetch(apiUrl)
      .then(r => {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then(d => {
        if (cancelled) return;
        const availCount = Object.values(d.availability || {}).filter((x: any) => x.available).length;
        console.log('[RoomCalendar] Fetched', monthKey, '—', availCount, 'available. Aug-06:', JSON.stringify(d.availability?.['2026-08-06']), 'Aug-03:', JSON.stringify(d.availability?.['2026-08-03']));
        const newAvail = d.availability || {};
        setAvailability(newAvail);
        // Compute and set days immediately with new availability
        const newDays = computeCalendarDays(monthKey, newAvail);
        console.log('[RoomCalendar] Set days for', monthKey, ':', newDays.filter(d => d.available).map(d => d.dayOfMonth).join(','), '| todayLocal:', new Date().toLocaleDateString('en-CA'));
        setDays(newDays);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[RoomCalendar] Fetch error:', err);
        setLoading(false);
      });
    
    return () => { cancelled = true; };
  }, [monthKey, roomId]);

  // Group days into weeks
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const prevMonth = () => {
    const y = currentMonth.getUTCFullYear();
    const m = currentMonth.getUTCMonth();
    setCurrentMonth(new Date(Date.UTC(y, m - 1, 1)));
  };

  const nextMonth = () => {
    const y = currentMonth.getUTCFullYear();
    const m = currentMonth.getUTCMonth();
    setCurrentMonth(new Date(Date.UTC(y, m + 1, 1)));
  };

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{monthName}</h3>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={prevMonth} className="p-2 h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={nextMonth} className="p-2 h-8 w-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">
          <div className="animate-spin inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full mb-2" />
          <p className="text-sm">Loading calendar...</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 text-center text-xs font-semibold text-slate-600">{day}</div>
            ))}
          </div>
          <div className="divide-y divide-slate-200">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 divide-x divide-slate-200">
                {week.map((day, dayIdx) => {
                  const isSelected = day.date === selectedDate;
                  const isClickable = day.date && day.available;

                  return (
                    <div key={dayIdx} className="aspect-square p-1 sm:p-2 flex items-center justify-center min-h-16">
                      {day.dayOfMonth > 0 && (
                        <button
                          onClick={() => isClickable && onDateSelect(day.date)}
                          disabled={!isClickable}
                          className={`w-full h-full rounded-lg text-sm font-medium transition-all flex items-center justify-center ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-2 border-indigo-400 shadow-lg'
                              : isClickable
                              ? 'bg-emerald-50 text-slate-900 border-2 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                              : 'bg-white text-slate-400 border-2 border-slate-100 cursor-not-allowed'
                          }`}
                        >
                          <span className={day.isToday ? 'font-bold' : ''}>{day.dayOfMonth}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="p-3 bg-slate-50 grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-200" />
              <span className="text-slate-600">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-white border border-slate-200" />
              <span className="text-slate-600">Unavailable</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-indigo-600 border border-indigo-400" />
              <span className="text-slate-600">Selected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}