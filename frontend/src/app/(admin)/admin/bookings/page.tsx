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
import { Building2, Calendar as CalendarIcon, Tag, AlignLeft, Users, ShieldAlert } from 'lucide-react';

// Dynamically import FullCalendar wrapper to avoid SSR problems in Next.js
const BookingCalendar = dynamic(() => import('@/components/calendar/BookingCalendar'), {
  ssr: false,
});

export default function AdminBookingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Dialog Modals State
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [bookingTitle, setBookingTitle] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingStart, setBookingStart] = useState('');
  const [bookingEnd, setBookingEnd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

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
        const isBlock = b.title.startsWith('ADMIN BLOCK:') || b.title.includes('Closed for Maintenance');
        
        return {
          id: b.id,
          title: `[${roomName}] ${b.title}`,
          start: b.startTime,
          end: b.endTime,
          backgroundColor: isBlock ? '#b91c1c' : '#4f46e5',
          borderColor: isBlock ? '#ef4444' : '#6366f1',
          textColor: '#f8fafc',
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

  // Helper format datetime-local
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Handle clicking/dragging an empty slot on the calendar
  const handleDateSelect = (selectInfo: any) => {
    const start = new Date(selectInfo.startStr);
    const end = new Date(selectInfo.endStr);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setBookingStart(format(start));
    setBookingEnd(format(end));
    setBookingTitle('ADMIN BLOCK: Maintenance');
    setBookingNotes('Administrative override booking');

    // Default to the first active room
    if (rooms.length > 0) {
      setSelectedRoomId(rooms[0].id);
    } else {
      setSelectedRoomId('');
    }

    setIsBookModalOpen(true);
  };

  // Handle clicking an event to edit or cancel it
  const handleEventClick = (clickInfo: any) => {
    const booking: Booking = clickInfo.event.extendedProps.booking;
    setSelectedBooking(booking);
    setBookingTitle(booking.title);
    setSelectedRoomId(booking.roomId);
    setBookingStart(formatDateTime(booking.startTime));
    setBookingEnd(formatDateTime(booking.endTime));
    setBookingNotes(booking.notes || '');
    setIsEditModalOpen(true);
  };

  // Handle Drag and Drop Rescheduling
  const handleEventDrop = async (dropInfo: any) => {
    const bookingId = dropInfo.event.id;
    const newStart = dropInfo.event.startStr;
    const newEnd = dropInfo.event.endStr;

    try {
      await api.patch(`/bookings/${bookingId}`, {
        startTime: new Date(newStart).toISOString(),
        endTime: new Date(newEnd).toISOString(),
      });
      toast.success('Reservation rescheduled successfully!');
      loadBuildingData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Conflict detected! Reschedule reverted.');
      dropInfo.revert();
    }
  };

  // Handle creating administrative block / booking
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || !bookingTitle || !bookingStart || !bookingEnd) {
      toast.error('Please enter all fields');
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

      toast.success('Booking / administrative block created successfully!');
      setIsBookModalOpen(false);
      loadBuildingData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle updating existing booking
  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setIsSubmitting(true);
    try {
      await api.patch(`/bookings/${selectedBooking.id}`, {
        roomId: selectedRoomId,
        title: bookingTitle,
        notes: bookingNotes || undefined,
        startTime: new Date(bookingStart).toISOString(),
        endTime: new Date(bookingEnd).toISOString(),
      });

      toast.success('Reservation successfully modified');
      setIsEditModalOpen(false);
      loadBuildingData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Reschedule conflict detected!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle administrative cancellation/deletion
  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await api.patch(`/bookings/${selectedBooking.id}/cancel`);
      toast.success('Booking successfully cancelled');
      setIsEditModalOpen(false);
      loadBuildingData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cancellation failed');
    }
  };

  return (
    <DashboardLayout title="Master Operations Calendar" description="Drag-and-drop slots, create room maintenance blocks, or edit schedules directly." allowedRoles={['ROOM_ADMIN']}>
      {/* Filters Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 border border-slate-900 glass">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              <span>Location Context</span>
            </CardTitle>
            <CardDescription>Filter the master board by building</CardDescription>
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

        {/* Master Details Info Box */}
        <Card className="lg:col-span-3 border border-indigo-500/10 bg-indigo-500/5 glass flex items-center p-5 gap-4">
          <ShieldAlert className="w-10 h-10 text-indigo-400 shrink-0" />
          <div className="text-xs text-indigo-300 space-y-1">
            <p className="font-bold text-sm text-slate-200">🛠️ Administrative Management Console:</p>
            <p>You have full override authority. Drag and drop any booking block to reschedule instantly.</p>
            <p>Clicking an existing block allows you to force edit, move rooms, or completely cancel reservations.</p>
          </div>
        </Card>
      </div>

      {/* Calendar Grid */}
      <div className="space-y-2">
        <BookingCalendar
          events={calendarEvents}
          onDateSelect={handleDateSelect}
          onEventClick={handleEventClick}
          onEventDrop={handleEventDrop}
          editable={true}
        />
      </div>

      {/* Administrative Create Block Modal */}
      <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="Create Override Block / Booking" size="md">
        <form onSubmit={handleCreateBooking} className="space-y-4">
          <Select
            label="Target Workspace Room"
            options={rooms.map((r) => ({ value: r.id, label: `${r.name} (${r.status})` }))}
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            required
          />

          <Input
            label="Block / Reservation Title"
            type="text"
            placeholder="e.g., ADMIN BLOCK: Out of Order"
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
              required
            />
            <Input
              label="End Datetime"
              type="datetime-local"
              value={bookingEnd}
              onChange={(e) => setBookingEnd(e.target.value)}
              required
            />
          </div>

          <Input
            label="Internal Notes"
            type="text"
            placeholder="Reason for block/reservation"
            value={bookingNotes}
            onChange={(e) => setBookingNotes(e.target.value)}
            leftIcon={<AlignLeft className="w-4 h-4" />}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" onClick={() => setIsBookModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Apply Block
            </Button>
          </div>
        </form>
      </Modal>

      {/* Administrative Edit Override Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Override / Reschedule Booking" size="md">
        <form onSubmit={handleUpdateBooking} className="space-y-4">
          <Select
            label="Assigned Workspace Room"
            options={rooms.map((r) => ({ value: r.id, label: r.name }))}
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            required
          />

          <Input
            label="Reservation Title"
            type="text"
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
              required
            />
            <Input
              label="End Datetime"
              type="datetime-local"
              value={bookingEnd}
              onChange={(e) => setBookingEnd(e.target.value)}
              required
            />
          </div>

          <Input
            label="Reservation Notes"
            type="text"
            value={bookingNotes}
            onChange={(e) => setBookingNotes(e.target.value)}
            leftIcon={<AlignLeft className="w-4 h-4" />}
          />

          <div className="flex items-center justify-between pt-4 border-t border-slate-800/40">
            <Button type="button" variant="danger" onClick={handleCancelBooking}>
              Cancel Reservation
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Close
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Save Reschedule
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
