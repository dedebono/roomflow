'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import api, { getImageUrl } from '@/lib/api';
import { paymentGatewaysApi } from '@/lib/api';
import { formatRupiah, formatDate } from '@/lib/format';
import { Room, BookingHold } from '@/types';
import toast from 'react-hot-toast';
import {
  Calendar, Clock, Users, MapPin, Wifi, Monitor, Coffee,
  ArrowLeft, Upload, CheckCircle, Timer, ExternalLink, CreditCard, Loader2,
} from 'lucide-react';
import { RoomCalendar } from '@/components/rental/RoomCalendar';
import { TimeSlotSelector } from '@/components/rental/TimeSlotSelector';
import { BookingSummary } from '@/components/rental/BookingSummary';

const formatTimeDisplay = (isoStr: string) => isoStr.substring(11, 16);  // "2026-06-23T09:00:00.000Z" -> "09:00"

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  available: boolean;
}

interface PaymentGatewayOption {
  id: string;
  name: string;
  logo?: string;
  description?: string;
  config?: {
    apiUrl?: string;
    apiKey?: string;
    projectSlug?: string;
    virtualAccount?: string;
  };
}

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const holdIdFromQuery = searchParams.get('holdId');

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [activeHold, setActiveHold] = useState<BookingHold | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [gateways, setGateways] = useState<PaymentGatewayOption[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayOption | null>(null);
  const [isLoadingGateways, setIsLoadingGateways] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);

  // Manual upload state
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch room details
  const fetchRoom = useCallback(async () => {
    try {
      const res = await api.get(`/rooms/${roomId}`);
      const data = res.data;
      const normalized = {
        ...data,
        amenities: Array.isArray(data.amenities)
          ? data.amenities
          : typeof data.amenities === 'string'
            ? data.amenities.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [],
        imageUrl: data.imageUrl
          ? getImageUrl(data.imageUrl)
          : undefined,
      };
      setRoom(normalized);
    } catch {
      toast.error('Failed to load room details');
      router.push('/renter/rooms');
    }
  }, [roomId, router]);

  // Fetch active booking hold — use holdId from query if available
  const fetchActiveHold = useCallback(async () => {
    try {
      let res;
      if (holdIdFromQuery) {
        // Fetch specific hold by ID
        res = await api.get(`/rentals/holds/${holdIdFromQuery}`);
        setActiveHold(res.data);
      } else {
        // Fetch active hold for this room
        res = await api.get(`/rentals/active-hold`, {
          params: { roomId },
        });
        setActiveHold(res.data);
      }
    } catch {
      setActiveHold(null);
    }
  }, [roomId, holdIdFromQuery]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchRoom();
      await fetchActiveHold();
      setLoading(false);
    };
    init();
  }, [fetchRoom, fetchActiveHold]);

  const formatTime = (isoString: string) => {
    // Extract HH:MM directly from ISO string — preserves the local time the admin set
    return isoString.substring(11, 16);
  };

  // Fetch available time slots for selected date
  const fetchTimeSlots = useCallback(async (date: string) => {
    if (!date) return;
    setLoadingSlots(true);
    try {
      const res = await api.get(`/rentals/available-slots`, {
        params: { roomId, date },
      });
      setTimeSlots(res.data);
      setSelectedSlot(null); // Clear previous selection
    } catch {
      toast.error('Failed to load available time slots');
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [roomId]);

  // Handle date selection
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    fetchTimeSlots(date);
  };

  // Create booking hold
  const handleCreateHold = async () => {
    if (!selectedSlot || !selectedDate) {
      toast.error('Please select a date and time slot');
      return;
    }

    setIsSubmitting(true);
    try {
      const extractTime = (isoString: string) => isoString.split('T')[1].substring(0, 5);

      const res = await api.post('/rentals/create-hold', {
        roomId,
        date: selectedDate,
        startTime: extractTime(selectedSlot.startTime),
        endTime: extractTime(selectedSlot.endTime),
      });
      setActiveHold(res.data);
      toast.success('Booking hold created! Complete payment within 1 hour.');
      setSelectedSlot(null);
      setSelectedDate('');
      setTimeSlots([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create booking hold');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel booking hold
  const handleCancelHold = async () => {
    if (!activeHold) return;
    if (!confirm('Are you sure you want to cancel this booking hold?')) return;

    try {
      await api.delete(`/rentals/holds/${activeHold.id}`);
      toast.success('Booking hold cancelled');
      setActiveHold(null);
      router.push('/renter/rooms');
    } catch {
      toast.error('Failed to cancel booking hold');
    }
  };

  // Open payment modal — fetch available gateways
  const openPaymentModal = async () => {
    setIsPaymentModalOpen(true);
    setSelectedGateway(null);
    setPaymentFile(null);
    setIsLoadingGateways(true);
    try {
      const data = await paymentGatewaysApi.getAvailable();
      setGateways(data);
    } catch {
      toast.error('Failed to load payment gateways');
    } finally {
      setIsLoadingGateways(false);
    }
  };

  // Initiate Pakasir payment
  const handleInitiatePakasir = async () => {
    if (!selectedGateway || !activeHold) return;
    setIsInitiating(true);
    try {
      const res = await api.post('/payments/initiate', {
        bookingHoldId: activeHold.id,
        gatewayId: selectedGateway.id,
      });
      const { paymentUrl } = res.data;
      if (paymentUrl) {
        toast.success('Redirecting to Pakasir payment page...');
        window.open(paymentUrl, '_blank');
        setIsPaymentModalOpen(false);
        // Refresh hold after a moment to check status
        setTimeout(() => fetchActiveHold(), 5000);
      } else {
        toast.error('No payment URL returned from gateway');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to initiate payment');
    } finally {
      setIsInitiating(false);
    }
  };

  // Upload manual payment proof
  const handlePaymentUpload = async () => {
    if (!paymentFile || !activeHold) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('paymentData', JSON.stringify({ bookingHoldId: activeHold.id, amount: activeHold.price }));
      formData.append('file', paymentFile);

      await api.post('/payments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Payment proof uploaded! Awaiting manager approval.');
      setIsPaymentModalOpen(false);
      setPaymentFile(null);
      fetchActiveHold();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload payment proof');
    } finally {
      setIsUploading(false);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (!activeHold || activeHold.status !== 'ACTIVE') {
      setCountdown('');
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const expires = new Date(activeHold.expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setCountdown('Expired');
        fetchActiveHold();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeHold, fetchActiveHold]);

  // Format amenities
  const getAmenityIcon = (amenity: string) => {
    const lower = amenity.toLowerCase();
    if (lower.includes('wifi') || lower.includes('internet')) return <Wifi className="w-4 h-4" />;
    if (lower.includes('projector') || lower.includes('screen') || lower.includes('monitor')) return <Monitor className="w-4 h-4" />;
    if (lower.includes('coffee') || lower.includes('kitchen') || lower.includes('tea')) return <Coffee className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!room) {
    return (
      <Card className="border border-[#cbe2f0] dark:border-[#3a3a3a] glass text-center py-12">
        <CardContent>
          <p className="text-[#747474] dark:text-[#a8a8a8]">Room not found.</p>
          <Link href="/renter/rooms" className="mt-4 inline-block">
            <Button variant="secondary">Back to Rooms</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const amenities = room.amenities || [];

  return (
    <>
      {/* Back Button */}
      <Link href="/renter/rooms" className="inline-flex items-center gap-2 text-[#747474] dark:text-[#a8a8a8] hover:text-[#143258] dark:hover:text-[#e8e8e8] mb-4">
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-semibold">Back to Rooms</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Details & Calendar */}
        <div className="lg:col-span-2 space-y-6">
          {/* Room Image */}
          <Card className="border border-[#cbe2f0] dark:border-[#3a3a3a] glass overflow-hidden">
            <div className="relative h-64 bg-[#fefefe] dark:bg-[#2a2a2a]">
              {room.imageUrl ? (
                <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#747474] dark:text-[#a8a8a8]">
                  <MapPin className="w-16 h-16" />
                </div>
              )}
              <div className="absolute top-4 right-4 flex gap-2">
                <Badge variant={room.status === 'ACTIVE' ? 'success' : 'warning'}>{room.status}</Badge>
                {room.isRentable && <Badge variant="info">For Rent</Badge>}
              </div>
            </div>
          </Card>

          {/* Room Info */}
          <Card className="border border-[#cbe2f0] dark:border-[#3a3a3a] glass">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">{room.name}</CardTitle>
              <CardDescription>{room.building?.name || 'Building'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-[#747474] dark:text-[#a8a8a8]">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#264da1] dark:text-[#93c5fd]" />
                  Up to {room.capacity} guests
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#264da1] dark:text-[#93c5fd]" />
                  {room.building?.name || 'Building'}
                </span>
              </div>
              {room.description && <p className="text-[#474547] dark:text-[#e8e8e8] text-sm">{room.description}</p>}
              {amenities.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {amenities.map((amenity: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#cbe2f0] dark:bg-[#1a3a5c] text-[#474547] dark:text-[#cbe2f0] text-xs rounded-full">
                      {getAmenityIcon(amenity)}
                      {amenity}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendar & Time Selection */}
          {!activeHold ? (
            <>
              {/* Calendar */}
              <Card className="border border-[#cbe2f0] dark:border-[#3a3a3a] glass">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#264da1] dark:text-[#93c5fd]" />
                    Select Rental Date
                  </CardTitle>
                  <CardDescription>Choose your preferred date</CardDescription>
                </CardHeader>
                <CardContent>
                  <RoomCalendar
                    roomId={roomId}
                    onDateSelect={handleDateSelect}
                    selectedDate={selectedDate}
                  />
                </CardContent>
              </Card>

              {/* Time Slots */}
              {selectedDate && (
                <Card className="border border-[#cbe2f0] dark:border-[#3a3a3a] glass">
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#264da1] dark:text-[#93c5fd]" />
                      Select Time Slot
                    </CardTitle>
                    <CardDescription>Choose your preferred time for {selectedDate}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TimeSlotSelector
                      slots={timeSlots}
                      selectedSlot={selectedSlot}
                      onSlotSelect={setSelectedSlot}
                      loading={loadingSlots}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>

        {/* Sidebar: Booking Status or Summary */}
        <div className="space-y-6">
          {activeHold ? (
            <Card className="border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  Booking Hold Active
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <p className="text-[#747474] dark:text-[#a8a8a8]">
                    <span className="font-semibold text-[#474547] dark:text-[#e8e8e8]">Date:</span> {formatDate(activeHold.holdDate)}
                  </p>
                  <p className="text-[#747474] dark:text-[#a8a8a8]">
                    <span className="font-semibold text-[#474547] dark:text-[#e8e8e8]">Time:</span> {formatTimeDisplay(activeHold.startTime)} - {formatTimeDisplay(activeHold.endTime)}
                  </p>
                  <p className="text-[#747474] dark:text-[#a8a8a8]">
                    <span className="font-semibold text-[#474547] dark:text-[#e8e8e8]">Amount:</span> {formatRupiah(activeHold.price)}
                  </p>
                  <p className="text-[#747474] dark:text-[#a8a8a8]">
                    <span className="font-semibold text-[#474547] dark:text-[#e8e8e8]">Status:</span> {activeHold.status}
                  </p>
                  {countdown && (
                    <p className="text-[#f7b917] flex items-center gap-1">
                      <Timer className="w-4 h-4" />
                      Expires in: {countdown}
                    </p>
                  )}
                </div>

                {activeHold.status === 'ACTIVE' && (
                  <div className="space-y-2">
                    <Button variant="primary" onClick={openPaymentModal} className="w-full">
                      <CreditCard className="w-4 h-4" />
                      Pay Now
                    </Button>
                    <Button variant="secondary" onClick={handleCancelHold} className="w-full">
                      Cancel Hold
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <BookingSummary
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              roomName={room.name}
              onCreateHold={handleCreateHold}
              isLoading={isSubmitting}
            />
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Complete Payment"
      >
        <div className="space-y-4">
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
                onClick={handleInitiatePakasir}
                disabled={!selectedGateway || isInitiating}
                className="w-full"
              >
                {isInitiating ? 'Processing...' : 'Pay via Gateway'}
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : null}

          <div className="border-t border-slate-200 pt-4">
            <label className="text-sm font-semibold text-slate-600 block mb-2">Or Upload Payment Proof</label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100"
              />
              <Button
                variant="secondary"
                onClick={handlePaymentUpload}
                disabled={!paymentFile || isUploading}
                className="w-full"
              >
                {isUploading ? 'Uploading...' : 'Upload Proof'}
                <Upload className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
