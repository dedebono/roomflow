'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import api from '@/lib/api';
import { Booking, BookingHold } from '@/types';
import toast from 'react-hot-toast';
import { formatRupiah, formatTime, formatDateTime } from '@/lib/format';
import { Calendar, Clock, MapPin, CreditCard, CheckCircle, XCircle, Timer, DoorOpen } from 'lucide-react';

interface RentalBooking {
  id: string;
  type: 'booking_hold' | 'confirmed';
  // BookingHold fields
  holdDate?: string;
  holdStartTime?: string;
  holdEndTime?: string;
  holdStatus?: 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  holdExpiresAt?: string;
  // Booking fields
  bookingTitle?: string;
  bookingStartTime?: string;
  bookingEndTime?: string;
  bookingStatus?: 'BOOKED' | 'CANCELLED';
  // Common fields
  roomId: string;
  room?: any;
  price: number;
  paymentStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
}

export default function RenterBookingsPage() {
  const [bookings, setBookings] = useState<RentalBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch rental bookings (booking holds)
      const holdsRes = await api.get('/rentals/my-holds');
      const holds: BookingHold[] = holdsRes.data;

      // Transform holds into unified format
      const rentalBookings: RentalBooking[] = holds.map((hold) => ({
        id: hold.id,
        type: 'booking_hold',
        holdDate: hold.holdDate,
        holdStartTime: hold.startTime,
        holdEndTime: hold.endTime,
        holdStatus: hold.status as any,
        holdExpiresAt: hold.expiresAt,
        roomId: hold.roomId,
        room: hold.room,
        price: hold.price,
        paymentStatus: hold.payment?.status,
        createdAt: hold.createdAt,
      }));

      setBookings(rentalBookings);
    } catch {
      toast.error('Failed to load booking history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const getStatusBadge = (booking: RentalBooking) => {
    if (booking.type === 'booking_hold') {
      const status = booking.holdStatus;
      switch (status) {
        case 'ACTIVE':
          return <Badge variant="warning">Waiting for Payment</Badge>;
        case 'CONVERTED':
          return <Badge variant="success">Confirmed</Badge>;
        case 'EXPIRED':
          return <Badge variant="danger">Expired</Badge>;
        case 'CANCELLED':
          return <Badge variant="neutral">Cancelled</Badge>;
        default:
          return <Badge variant="neutral">{status}</Badge>;
      }
    }
    return <Badge variant="neutral">{booking.bookingStatus}</Badge>;
  };

  const columns = [
    {
      header: 'Room',
      cell: (b: RentalBooking) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#cbe2f0] flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-[#264da1] dark:text-[#93c5fd]" />
          </div>
          <div>
            <p className="font-bold text-[#143258] dark:text-[#e8e8e8]">{b.room?.name || 'Room'}</p>
            <p className="text-xs text-[#747474] dark:text-[#a8a8a8] flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {b.room?.building?.name || 'Building'}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Scheduled Time',
      cell: (b: RentalBooking) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-[#264da1] dark:text-[#93c5fd] font-semibold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {b.holdDate ? formatDateTime(b.holdDate, formatTime(b.holdStartTime || '')) : 'N/A'}
          </span>
          <span className="text-xs text-[#747474] dark:text-[#a8a8a8] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(b.holdStartTime || '')} - {formatTime(b.holdEndTime || '')}
          </span>
        </div>
      ),
    },
    {
      header: 'Price',
      cell: (b: RentalBooking) => (
        <span className="font-semibold text-[#474547] dark:text-[#e8e8e8]">{formatRupiah(b.price)}</span>
      ),
    },
    {
      header: 'Status',
      cell: (b: RentalBooking) => getStatusBadge(b),
    },
    {
      header: 'Payment',
      cell: (b: RentalBooking) => {
        if (b.holdStatus === 'ACTIVE') {
          return <Badge variant="warning">Pending</Badge>;
        }
        if (b.paymentStatus) {
          const variants: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
            APPROVED: 'success',
            PENDING: 'warning',
            REJECTED: 'danger',
          };
          return <Badge variant={variants[b.paymentStatus] || 'neutral'}>{b.paymentStatus}</Badge>;
        }
        return <span className="text-[#747474] dark:text-[#a8a8a8] text-xs">-</span>;
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (b: RentalBooking) => (
        <div className="flex items-center justify-end gap-2">
          {b.holdStatus === 'ACTIVE' && (
            <Link href={`/renter/rooms/${b.roomId}?holdId=${b.id}`}>
              <Button size="sm" variant="primary">
                <CreditCard className="w-3.5 h-3.5" />
                Pay Now
              </Button>
            </Link>
          )}
          {b.holdStatus === 'CONVERTED' && (
            <Link href={`/renter/rooms/${b.roomId}`}>
              <Button size="sm" variant="secondary">
                View Room
              </Button>
            </Link>
          )}
          {(b.holdStatus === 'EXPIRED' || b.holdStatus === 'CANCELLED') && (
            <Link href={`/renter/rooms/${b.roomId}`}>
              <Button size="sm" variant="ghost">
                Re-book
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ];

  // Stats
  const activeBookings = bookings.filter((b) => b.holdStatus === 'ACTIVE' || b.holdStatus === 'CONVERTED').length;
  const pendingPayments = bookings.filter((b) => b.holdStatus === 'ACTIVE').length;
  const totalSpent = bookings
    .filter((b) => b.holdStatus === 'CONVERTED')
    .reduce((sum, b) => sum + b.price, 0);

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[#cbe2f0] dark:border-[#3a3a3a] glass">
          <CardHeader className="p-0 mb-2">
            <CardTitle className="text-sm text-[#747474] dark:text-[#a8a8a8]">Active Rentals</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-3xl font-bold text-[#143258] dark:text-[#e8e8e8] flex items-center gap-2">
              <DoorOpen className="w-7 h-7 text-emerald-500" />
              {activeBookings}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-[#cbe2f0] dark:border-[#3a3a3a] glass">
          <CardHeader className="p-0 mb-2">
            <CardTitle className="text-sm text-[#747474] dark:text-[#a8a8a8]">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-3xl font-bold text-[#143258] dark:text-[#e8e8e8] flex items-center gap-2">
              <Timer className="w-7 h-7 text-[#f7b917]" />
              {pendingPayments}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-[#cbe2f0] dark:border-[#3a3a3a] glass">
          <CardHeader className="p-0 mb-2">
            <CardTitle className="text-sm text-[#747474] dark:text-[#a8a8a8]">Total Spent</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-3xl font-bold text-[#143258] dark:text-[#e8e8e8] flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-[#264da1]" />
              {formatRupiah(totalSpent)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bookings Table */}
      <Card className="border border-[#cbe2f0] dark:border-[#3a3a3a] glass">
        <CardHeader className="p-0 mb-4 flex-row items-center justify-between">
          <div>
            <CardTitle>Rental Bookings</CardTitle>
            <CardDescription>Your room rental history and active reservations</CardDescription>
          </div>
          <Link href="/renter/rooms">
            <Button size="sm" variant="primary">
              Book New Room
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={bookings}
            emptyMessage="You don't have any rental bookings yet. Browse available rooms to book your first rental!"
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </>
  );
}
