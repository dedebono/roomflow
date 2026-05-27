'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Booking, BookingChangeRequest, Room } from '@/types';
import toast from 'react-hot-toast';
import { Calendar, Trash2, Edit3, AlignLeft, Info } from 'lucide-react';

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [changeRequests, setChangeRequests] = useState<BookingChangeRequest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modification Modal State
  const [isModModalOpen, setIsModModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [reqStart, setReqStart] = useState('');
  const [reqEnd, setReqEnd] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cancellation Request Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelSubmitting, setIsCancelSubmitting] = useState(false);

  // Fetch initial details
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch personal bookings
      const bookingsRes = await api.get('/bookings');
      setBookings(bookingsRes.data);

      // 2. Fetch change requests
      const requestsRes = await api.get('/booking-change-requests');
      setChangeRequests(requestsRes.data);

      // 3. Fetch rooms for reference
      const roomsRes = await api.get('/rooms');
      setRooms(roomsRes.data);
    } catch (err: any) {
      toast.error('Failed to load reservations data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Booking Cancellation
  const handleCancelBooking = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await api.patch(`/bookings/${id}/cancel`);
      toast.success('Reservation cancelled');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cancellation failed');
    }
  };

  // Open Cancellation Request Modal (for USER role)
  const handleOpenCancelModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  // Submit Cancellation Request
  const handleSubmitCancelRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setIsCancelSubmitting(true);
    try {
      await api.post('/booking-change-requests', {
        bookingId: selectedBooking.id,
        reason: cancelReason.trim(),
      });
      toast.success('Cancellation request submitted. Your manager will review it shortly.');
      setIsCancelModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setIsCancelSubmitting(false);
    }
  };

  // Format Helper to prep ISO-string for input fields
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Open Modification Request Modal
  const handleOpenModModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setTargetRoomId(booking.roomId);
    setReqStart(formatDateTime(booking.startTime));
    setReqEnd(formatDateTime(booking.endTime));
    setReqReason('');
    setIsModModalOpen(true);
  };

  // Submit Modification Request
  const handleSubmitModRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !targetRoomId || !reqStart || !reqEnd || !reqReason) {
      toast.error('Please fill in all modification fields');
      return;
    }

    if (new Date(reqStart) >= new Date(reqEnd)) {
      toast.error('Start time must be before end time');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/booking-change-requests', {
        bookingId: selectedBooking.id,
        requestedRoomId: targetRoomId !== selectedBooking.roomId ? targetRoomId : undefined,
        requestedStart: new Date(reqStart).toISOString(),
        requestedEnd: new Date(reqEnd).toISOString(),
        reason: reqReason,
      });

      toast.success('Modification request submitted successfully');
      setIsModModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format DateTime Strings nicely
  const displayDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Table structures
  const bookingColumns = [
    {
      header: 'Reservation Title',
      accessor: 'title' as const,
      cell: (b: Booking) => (
        <div>
          <p className="font-bold text-slate-100">{b.title}</p>
          {b.notes && <p className="text-xs text-slate-400 italic max-w-xs truncate mt-0.5">&ldquo;{b.notes}&rdquo;</p>}
        </div>
      ),
    },
    {
      header: 'Location & Room',
      cell: (b: Booking) => (
        <div>
          <p className="font-semibold text-slate-200">{b.room?.name || 'Room'}</p>
          <p className="text-xs text-slate-400">{b.room?.building?.name || 'Building'}</p>
        </div>
      ),
    },
    {
      header: 'Scheduled Duration',
      cell: (b: Booking) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {displayDateTime(b.startTime)}
          </span>
          <span className="text-xs text-slate-400 pl-4.5">to {displayDateTime(b.endTime)}</span>
        </div>
      ),
    },
    {
      header: 'State',
      cell: (b: Booking) => (
        <Badge variant={b.status === 'BOOKED' ? 'success' : 'danger'}>
          {b.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (b: Booking) => {
        const isUser = user?.role === 'USER';
        return (
          <div className="flex items-center justify-end gap-2">
            {b.status === 'BOOKED' && (
              <>
                {isUser ? (
                  <Button size="sm" variant="danger" onClick={() => handleOpenCancelModal(b)}>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Request Cancellation</span>
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => handleCancelBooking(b.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => handleOpenModModal(b)}>
                  <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Reschedule</span>
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const requestColumns = [
    {
      header: 'Original Reservation',
      cell: (r: BookingChangeRequest) => (
        <span className="font-semibold text-slate-200">{r.booking?.title || 'Reservation'}</span>
      ),
    },
    {
      header: 'Proposed Modifications',
      cell: (r: BookingChangeRequest) => {
        const roomName = rooms.find((rm) => rm.id === r.requestedRoomId)?.name;
        return (
          <div className="flex flex-col gap-0.5 text-xs text-slate-400">
            {roomName && (
              <p>
                🚪 Room: <span className="font-semibold text-indigo-400">{roomName}</span>
              </p>
            )}
            {r.requestedStart && (
              <p>
                ⏰ Time: <span className="font-semibold text-indigo-400">{displayDateTime(r.requestedStart)} - {displayDateTime(r.requestedEnd || '')}</span>
              </p>
            )}
            {r.reason && <p className="italic text-slate-500 mt-1 max-w-[200px] truncate">&ldquo;{r.reason}&rdquo;</p>}
          </div>
        );
      },
    },
    {
      header: 'Filed On',
      cell: (r: BookingChangeRequest) => (
        <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      header: 'Request Status',
      cell: (r: BookingChangeRequest) => {
        const variants = {
          PENDING: 'warning' as const,
          APPROVED: 'success' as const,
          REJECTED: 'danger' as const,
        };
        return <Badge variant={variants[r.status]}>{r.status}</Badge>;
      },
    },
  ];

  return (
    <DashboardLayout title="My Bookings" description="Manage your current office reservations and track changes.">
      {/* active bookings */}
      <Card className="border border-slate-900 glass">
        <CardHeader className="p-0 mb-4 flex-row items-center justify-between">
          <div>
            <CardTitle>Upcoming & Active Reservations</CardTitle>
            <CardDescription>Your active booking slots across corporate office rooms</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={bookingColumns}
            data={bookings}
            emptyMessage="You don't have any active room reservations. Visit the calendar dashboard to book a room!"
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Change Requests Section */}
      <Card className="border border-slate-900 glass">
        <CardHeader className="p-0 mb-4 flex-row items-center justify-between">
          <div>
            <CardTitle>Modification & Reschedule Requests</CardTitle>
            <CardDescription>Follow the approval status of your submitted change requests</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={requestColumns}
            data={changeRequests}
            emptyMessage="You haven't submitted any modification requests yet."
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Booking Modification Request Modal */}
      <Modal
        isOpen={isModModalOpen}
        onClose={() => setIsModModalOpen(false)}
        title={`Reschedule Reservation: ${selectedBooking?.title || ''}`}
        size="md"
      >
        <form onSubmit={handleSubmitModRequest} className="space-y-4">
          <div className="p-3.5 rounded-lg border border-indigo-500/10 bg-indigo-500/5 text-xs text-indigo-300 flex items-start gap-2 mb-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>Modification requests are routed to the Room Operations Manager for review and validation before they take effect.</span>
          </div>

          <Select
            label="Propose New Room"
            options={rooms.filter((r) => r.status === 'ACTIVE').map((r) => ({ value: r.id, label: `${r.name} (Capacity: ${r.capacity})` }))}
            value={targetRoomId}
            onChange={(e) => setTargetRoomId(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Propose New Start"
              type="datetime-local"
              value={reqStart}
              onChange={(e) => setReqStart(e.target.value)}
              required
            />
            <Input
              label="Propose New End"
              type="datetime-local"
              value={reqEnd}
              onChange={(e) => setReqEnd(e.target.value)}
              required
            />
          </div>

          <Input
            label="Reason for Modification"
            type="text"
            placeholder="e.g., Client sync moved, need a room with larger screen"
            value={reqReason}
            onChange={(e) => setReqReason(e.target.value)}
            required
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" onClick={() => setIsModModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancellation Request Modal (USER role only) */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={`Request Cancellation: ${selectedBooking?.title || ''}`}
        size="md"
      >
        <form onSubmit={handleSubmitCancelRequest} className="space-y-4">
          <div className="p-3.5 rounded-lg border border-amber-500/10 bg-amber-500/5 text-xs text-amber-300 flex items-start gap-2 mb-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>As a regular employee, you cannot cancel bookings directly. Your cancellation request will be sent to the Room Manager for approval.</span>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-800/30 text-xs text-slate-400">
            <p className="font-semibold text-slate-300 mb-1">{selectedBooking?.room?.name}</p>
            <p>{selectedBooking ? displayDateTime(selectedBooking.startTime) : ''} → {selectedBooking ? displayDateTime(selectedBooking.endTime) : ''}</p>
          </div>

          <Input
            label="Reason for Cancellation"
            type="text"
            placeholder="e.g., Meeting cancelled, double-booked, no longer needed"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            required
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" onClick={() => setIsCancelModalOpen(false)}>
              Back
            </Button>
            <Button type="submit" variant="primary" isLoading={isCancelSubmitting}>
              Submit Cancellation Request
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
