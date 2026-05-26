'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';
import { Building, Room, Booking } from '@/types';
import toast from 'react-hot-toast';
import { Building2, Users, Info, Calendar as CalendarIcon, Tag, AlignLeft } from 'lucide-react';

// Dynamically import FullCalendar wrapper to avoid SSR problems in Next.js
const BookingCalendar = dynamic(() => import('@/components/calendar/BookingCalendar'), {
  ssr: false,
});

export default function EmployeeDashboard() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Booking Modal Form State
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [bookingTitle, setBookingTitle] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingStart, setBookingStart] = useState('');
  const [bookingEnd, setBookingEnd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch initial building details
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const res = await api.get('/buildings');
        setBuildings(res.data);
        if (res.data.length > 0) {
          setSelectedBuildingId(res.data[0].id);
        }
      } catch (err: any) {
        toast.error('Failed to load buildings');
      }
    };
    fetchBuildings();
  }, []);

  // Fetch rooms & bookings when selectedBuildingId changes
  const loadBuildingData = useCallback(async () => {
    if (!selectedBuildingId) return;

    try {
      // 1. Fetch Rooms in Building
      const roomsRes = await api.get(`/rooms?buildingId=${selectedBuildingId}`);
      setRooms(roomsRes.data);

      // 2. Fetch all bookings
      const bookingsRes = await api.get('/bookings');
      const allBookings: Booking[] = bookingsRes.data;

      // Filter bookings that belong to the active building's rooms
      const activeRoomsIds = roomsRes.data.map((r: Room) => r.id);
      const buildingBookings = allBookings.filter((b) => activeRoomsIds.includes(b.roomId));
      setBookings(buildingBookings);

      // 3. Map bookings to FullCalendar events
      const events = buildingBookings.map((b) => {
        const roomName = roomsRes.data.find((r: Room) => r.id === b.roomId)?.name || 'Room';
        return {
          id: b.id,
          title: `[${roomName}] ${b.title}`,
          start: b.startTime,
          end: b.endTime,
          backgroundColor: '#4f46e5',
          borderColor: '#6366f1',
          textColor: '#e0e7ff',
          extendedProps: {
            booking: b,
            roomName,
          },
        };
      });
      setCalendarEvents(events);
    } catch (err: any) {
      toast.error('Failed to fetch rooms and bookings data');
    }
  }, [selectedBuildingId]);

  useEffect(() => {
    loadBuildingData();
  }, [loadBuildingData]);

  // Handle building dropdown change
  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBuildingId(e.target.value);
  };

  // Handle clicking/dragging a slot on the calendar
  const handleDateSelect = (selectInfo: any) => {
    const start = new Date(selectInfo.startStr);
    const end = new Date(selectInfo.endStr);

    // Format to yyyy-MM-ddThh:mm:ss for input fields
    const formatDateTime = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setBookingStart(formatDateTime(start));
    setBookingEnd(formatDateTime(end));

    // Reset details
    setBookingTitle('');
    setBookingNotes('');
    
    // Default to the first active room
    const activeRooms = rooms.filter((r) => r.status === 'ACTIVE');
    if (activeRooms.length > 0) {
      setSelectedRoomId(activeRooms[0].id);
    } else {
      setSelectedRoomId('');
    }

    setIsBookModalOpen(true);
  };

  // Handle clicking an event to see summary details
  const handleEventClick = (clickInfo: any) => {
    const booking: Booking = clickInfo.event.extendedProps.booking;
    const roomName = clickInfo.event.extendedProps.roomName;
    const startTimeStr = new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(booking.startTime).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

    toast(
      (t) => (
        <div className="flex flex-col gap-1 text-slate-200">
          <p className="font-bold text-sm text-white">{booking.title}</p>
          <p className="text-xs text-slate-400">🚪 Room: <span className="font-semibold text-slate-300">{roomName}</span></p>
          <p className="text-xs text-slate-400">📅 Date: <span className="font-semibold text-slate-300">{dateStr}</span></p>
          <p className="text-xs text-slate-400">⏰ Time: <span className="font-semibold text-slate-300">{startTimeStr} - {endTimeStr}</span></p>
          {booking.notes && <p className="text-xs text-slate-400 italic mt-1">📝 &ldquo;{booking.notes}&rdquo;</p>}
          <button
            onClick={() => {
              toast.dismiss(t.id);
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold self-end mt-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ),
      {
        duration: 5000,
        style: {
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      }
    );
  };

  // Handle form submission
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || !bookingTitle || !bookingStart || !bookingEnd) {
      toast.error('Please enter all booking fields');
      return;
    }

    if (new Date(bookingStart) >= new Date(bookingEnd)) {
      toast.error('Start time must be before end time');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/bookings', {
        roomId: selectedRoomId,
        title: bookingTitle,
        notes: bookingNotes || undefined,
        startTime: new Date(bookingStart).toISOString(),
        endTime: new Date(bookingEnd).toISOString(),
      });

      toast.success('Room successfully booked!');
      setIsBookModalOpen(false);
      loadBuildingData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Conflict detected! Try another time slot.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Employee Portal" description="Browse meeting rooms, view schedules, and book instantly.">
      {/* Filters & Information Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 border border-slate-900 glass flex flex-col justify-between">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              <span>Select Location</span>
            </CardTitle>
            <CardDescription>Choose which building calendar you want to browse</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Select
              options={buildings.map((b) => ({ value: b.id, label: b.name }))}
              value={selectedBuildingId}
              onChange={handleBuildingChange}
              placeholder="Select Building..."
            />
          </CardContent>
        </Card>

        {/* Quick Room Stats Card */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          {rooms.slice(0, 3).map((room) => (
            <Card key={room.id} className="border border-slate-900 glass bg-slate-900/10">
              <CardHeader className="p-0 flex items-center justify-between">
                <CardTitle className="text-sm truncate pr-2">{room.name}</CardTitle>
                <Badge variant={room.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {room.status}
                </Badge>
              </CardHeader>
              <CardContent className="p-0 mt-3 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Max: {room.capacity} people
                </span>
                <span className="flex items-center gap-1 font-medium italic truncate max-w-[150px]">
                  {room.description || 'General Meeting'}
                </span>
              </CardContent>
            </Card>
          ))}
          {rooms.length === 0 && (
            <div className="col-span-3 flex items-center justify-center p-8 border border-slate-900/60 rounded-xl glass text-slate-500 text-sm font-medium">
              No rooms configured in this building yet.
            </div>
          )}
        </div>
      </div>

      {/* Booking Calendar Pane */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold px-2">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>Tip: Click and drag any empty blocks on the calendar below to instantly open the booking form!</span>
        </div>
        <BookingCalendar
          events={calendarEvents}
          onDateSelect={handleDateSelect}
          onEventClick={handleEventClick}
        />
      </div>

      {/* Interactive Booking Creation Modal */}
      <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="New Reservation" size="md">
        <form onSubmit={handleCreateBooking} className="space-y-4">
          <Select
            label="Target Room"
            options={rooms.filter((r) => r.status === 'ACTIVE').map((r) => ({ value: r.id, label: `${r.name} (Max ${r.capacity} people)` }))}
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            required
          />

          <Input
            label="Booking Title"
            type="text"
            placeholder="e.g., Marketing Sync"
            value={bookingTitle}
            onChange={(e) => setBookingTitle(e.target.value)}
            leftIcon={<Tag className="w-4 h-4" />}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Datetime"
              type="datetime-local"
              value={bookingStart}
              onChange={(e) => setBookingStart(e.target.value)}
              leftIcon={<CalendarIcon className="w-4 h-4" />}
              required
            />
            <Input
              label="End Datetime"
              type="datetime-local"
              value={bookingEnd}
              onChange={(e) => setBookingEnd(e.target.value)}
              leftIcon={<CalendarIcon className="w-4 h-4" />}
              required
            />
          </div>

          <Input
            label="Additional Notes / Purpose"
            type="text"
            placeholder="e.g., Bring laptop, brainstorming session"
            value={bookingNotes}
            onChange={(e) => setBookingNotes(e.target.value)}
            leftIcon={<AlignLeft className="w-4 h-4" />}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" onClick={() => setIsBookModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Book Room
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
