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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Dialog Modals State
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [bookingTitle, setBookingTitle] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingStart, setBookingStart] = useState('');
  const [bookingEnd, setBookingEnd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Fetch all rooms directly (no building filter needed)
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await api.get('/rooms');
        setRooms(res.data);
        if (res.data.length > 0 && !selectedRoomId) {
          setSelectedRoomId(res.data[0].id);
        }
      } catch (err: any) {
        toast.error('Failed to load rooms');
      }
    };
    fetchRooms();
  }, []);

  // Fetch bookings when selectedRoomId changes
  const loadRoomBookings = useCallback(async () => {
    if (!selectedRoomId) {
      setCalendarEvents([]);
      return;
    }
    try {
      // Fetch bookings for this room only
      const bookingsRes = await api.get(`/bookings?roomId=${selectedRoomId}`);
      const roomBookings: Booking[] = bookingsRes.data;

      setBookings(roomBookings);

      // Map bookings to FullCalendar events
      const room = rooms.find((r: Room) => r.id === selectedRoomId);
      const roomName = room?.name || 'Room';

      const events = roomBookings.map((b) => {
        const isAdminBlock = b.title.startsWith('ADMIN BLOCK:') || b.title.includes('Closed for Maintenance');
        const bgColor = isAdminBlock ? '#b91c1c' : (b.isRental ? '#ef4444' : '#3b82f6');
        const borderColor = isAdminBlock ? '#ef4444' : (b.isRental ? '#f87171' : '#60a5fa');

        const startStr = typeof b.startTime === 'string' ? b.startTime : new Date(b.startTime).toISOString();
        const endStr = typeof b.endTime === 'string' ? b.endTime : new Date(b.endTime).toISOString();

        return {
          id: b.id,
          title: b.title,
          start: startStr,
          end: endStr,
          backgroundColor: bgColor,
          borderColor: borderColor,
          textColor: '#f8fafc',
          extendedProps: {
            booking: b,
            roomName,
          },
        };
      });
      setCalendarEvents(events);
    } catch {
      toast.error('Failed to fetch bookings');
    }
  }, [selectedRoomId, rooms]);

  useEffect(() => {
    if (selectedRoomId) {
      loadRoomBookings();
    }
  }, [loadRoomBookings]);

  // Handle room dropdown change
  const handleRoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRoomId(e.target.value);
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
    // Use the currently selected calendar room
    setSelectedRoomId(selectedRoomId);

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
      loadRoomBookings();
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
      loadRoomBookings();
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
      loadRoomBookings();
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
      loadRoomBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cancellation failed');
    }
  };

  return (
    <DashboardLayout title="Master Operations Calendar" description="Drag-and-drop slots, create room maintenance blocks, or edit schedules directly." allowedRoles={['ROOM_ADMIN']}>
      {/* Filters Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-slate-900 glass">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              <span>Select Room</span>
            </CardTitle>
            <CardDescription>Calendar shows bookings for the selected room</CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <Select
              options={rooms.map((r) => ({ value: r.id, label: `${r.name} (${r.status})` }))}
              value={selectedRoomId}
              onChange={handleRoomChange}
              placeholder="Select Room..."
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
        {/* Color Legend */}
        <div className="flex items-center gap-6 px-2 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-blue-500 border border-blue-400"></span>
            Employee Booking
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-red-500 border border-red-400"></span>
            Rental Booking
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-red-700 border border-red-600"></span>
            Admin Block
          </span>
        </div>
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
