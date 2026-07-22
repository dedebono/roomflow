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
import { Calendar, Clock, MapPin, CreditCard, CheckCircle, XCircle, Timer, DoorOpen, ShoppingBag, Loader2, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface RentalBooking {
  id: string;
  type: 'booking_hold' | 'confirmed';
  holdDate?: string;
  holdStartTime?: string;
  holdEndTime?: string;
  holdStatus?: 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  holdExpiresAt?: string;
  roomId: string;
  room?: any;
  price: number;
  paymentStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  bookingStatus?: 'BOOKED' | 'CANCELLED';
  createdAt: string;
}

export default function RenterBookingsPage() {
  const [bookings, setBookings] = useState<RentalBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHoldIds, setSelectedHoldIds] = useState<string[]>([]);
  const [isBatchPaying, setIsBatchPaying] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [gateways, setGateways] = useState<any[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<any>(null);
  const [isLoadingGateways, setIsLoadingGateways] = useState(false);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const holdsRes = await api.get('/rentals/my-holds');
      const holds: BookingHold[] = holdsRes.data;
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

  // Batch (shopping-bag) payment
  const activeHolds = bookings.filter((b) => b.holdStatus === 'ACTIVE');
  const batchTotal = selectedHoldIds
    .map((id) => bookings.find((b) => b.id === id))
    .filter(Boolean)
    .reduce((sum, b) => sum + (b?.price || 0), 0);

  const toggleSelect = (id: string) => {
    setSelectedHoldIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openBatchModal = async () => {
    if (selectedHoldIds.length === 0) {
      toast.error('Select at least one booking to pay');
      return;
    }
    setIsBatchModalOpen(true);
    setSelectedGateway(null);
    setIsLoadingGateways(true);
    try {
      const data = await api.get('/payments/gateways');
      setGateways(data?.data || []);
    } catch {
      toast.error('Failed to load payment gateways');
    } finally {
      setIsLoadingGateways(false);
    }
  };

  const handleBatchPay = async () => {
    if (!selectedGateway || selectedHoldIds.length === 0) return;
    setIsBatchPaying(true);
    try {
      const res = await api.post('/payments/initiate-batch', {
        bookingHoldIds: selectedHoldIds,
        gatewayId: selectedGateway.id,
      });
      const { paymentUrl } = res.data;
      if (paymentUrl) {
        toast.success('Redirecting to payment page for all selected bookings...');
        window.open(paymentUrl, '_blank');
        setIsBatchModalOpen(false);
        setSelectedHoldIds([]);
      } else {
        toast.error('No payment URL returned from gateway');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to initiate batch payment');
    } finally {
      setIsBatchPaying(false);
    }
  };

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

      {/* Pay-All bar */}
      {activeHolds.length > 0 && (
        <Card className="border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-sm font-semibold text-[#143258] dark:text-[#e8e8e8]">
                  {selectedHoldIds.length} selected · {formatRupiah(batchTotal)}
                </p>
                <p className="text-xs text-[#747474] dark:text-[#a8a8a8]">
                  {activeHolds.length} booking{activeHolds.length > 1 ? 's' : ''} waiting for payment
                </p>
              </div>
            </div>
            <Button variant="primary" onClick={() => {
              if (selectedHoldIds.length === 0) {
                setSelectedHoldIds(activeHolds.map((b) => b.id));
              }
              openBatchModal();
            }}>
              <CreditCard className="w-4 h-4" />
              {selectedHoldIds.length > 0 ? 'Pay All Selected' : `Pay All (${activeHolds.length})`}
            </Button>
          </CardContent>
        </Card>
      )}

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
            columns={[
              {
                header: 'Select',
                cell: (b: RentalBooking) =>
                  b.holdStatus === 'ACTIVE' ? (
                    <input
                      type="checkbox"
                      checked={selectedHoldIds.includes(b.id)}
                      onChange={() => toggleSelect(b.id)}
                      className="h-4 w-4"
                      aria-label="Select booking"
                    />
                  ) : null,
              },
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
                  </div>
                ),
              },
            ]}
            data={bookings}
            emptyMessage="You don't have any rental bookings yet. Browse available rooms to book your first rental!"
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Batch Payment Modal */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title={`Pay ${selectedHoldIds.length} Booking${selectedHoldIds.length > 1 ? 's' : ''}`}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
            <p className="text-sm text-slate-600">Total to pay for all selected bookings:</p>
            <p className="text-2xl font-bold text-indigo-600">{formatRupiah(batchTotal)}</p>
            <p className="text-xs text-slate-500 mt-1">
              One payment covers {selectedHoldIds.length} booking{selectedHoldIds.length > 1 ? 's' : ''}.
            </p>
          </div>

          {isLoadingGateways ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-500">Loading payment options...</p>
            </div>
          ) : gateways.length > 0 ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Select Payment Gateway</label>
                <div className="space-y-2">
                  {gateways.map((gateway) => (
                    <button
                      key={gateway.id}
                      onClick={() => setSelectedGateway(gateway)}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        selectedGateway?.id === gateway.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:border-indigo-300'
                      }`}
                    >
                      <p className="font-semibold text-slate-900">{gateway.name}</p>
                      {gateway.description && (
                        <p className="text-xs text-slate-500 mt-1">{gateway.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="primary"
                onClick={handleBatchPay}
                disabled={!selectedGateway || isBatchPaying}
                className="w-full"
              >
                {isBatchPaying ? 'Processing...' : `Pay ${formatRupiah(batchTotal)}`}
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No payment gateways available.</p>
          )}
        </div>
      </Modal>
    </>
  );
}
