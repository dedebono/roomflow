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
import { Room, BookingHold } from '@/types';
import toast from 'react-hot-toast';
import {
  Calendar, Clock, Users, MapPin, Wifi, Monitor, Coffee,
  ArrowLeft, Upload, CheckCircle, Timer, ExternalLink, CreditCard, Loader2,
} from 'lucide-react';

const formatRupiah = (amount: number | undefined) =>
  amount !== undefined
    ? 'Rp ' + amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : 'Rp -';

const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
    try {
      const res = await api.get(`/rentals/available-slots`, {
        params: { roomId, date },
      });
      setTimeSlots(res.data);
    } catch {
      toast.error('Failed to load available time slots');
    }
  }, [roomId]);

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
      <Card className="border border-slate-900 glass text-center py-12">
        <CardContent>
          <p className="text-slate-500">Room not found.</p>
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
      <Link href="/renter/rooms" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-semibold">Back to Rooms</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Room Image */}
          <Card className="border border-slate-900 glass overflow-hidden">
            <div className="relative h-64 bg-white">
              {room.imageUrl ? (
                <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
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
          <Card className="border border-slate-900 glass">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">{room.name}</CardTitle>
              <CardDescription>{room.building?.name || 'Building'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Up to {room.capacity} guests
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  {room.building?.name || 'Building'}
                </span>
              </div>
              {room.description && <p className="text-slate-600 text-sm">{room.description}</p>}
              {amenities.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {amenities.map((amenity: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/60 text-slate-600 text-xs rounded-full">
                      {getAmenityIcon(amenity)}
                      {amenity}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Date & Time Selection */}
          <Card className="border border-slate-900 glass">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                Select Rental Date & Time
              </CardTitle>
              <CardDescription>Choose your preferred date and hourly slot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="w-full flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">Rental Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot(null);
                    if (e.target.value) {
                      fetchTimeSlots(e.target.value);
                    } else {
                      setTimeSlots([]);
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-white/60 hover:bg-white/80 focus:bg-white text-slate-900 text-sm rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 px-3.5 py-2.5 transition-all duration-200 focus:ring-4 outline-none"
                />
              </div>

              {selectedDate && (
                <>
                  {timeSlots.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600 tracking-wide uppercase">Available Time Slots</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {timeSlots.map((slot, idx) => {
                          const isDisabled = !slot.available;
                          const isSelected = selectedSlot?.id === slot.id;
                          return (
                            <button
                              key={idx}
                              onClick={() => !isDisabled && setSelectedSlot(slot)}
                              disabled={isDisabled}
                              className={`p-3 rounded-xl text-sm font-bold transition-all border-2 flex flex-col items-center justify-center gap-1 ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30 scale-105'
                                  : isDisabled
                                    ? 'bg-white/40 border-slate-200 text-slate-600 cursor-not-allowed opacity-60 line-through'
                                    : 'bg-slate-100/40 border-slate-300/50 text-slate-800 hover:border-indigo-500/50 hover:bg-slate-100 hover:scale-[1.02]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-200' : 'text-indigo-400'}`} />
                                <span>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
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
                  ) : (
                    <p className="text-sm text-slate-500">No available time slots for this date.</p>
                  )}
                </>
              )}

              {selectedSlot && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <p className="text-sm text-indigo-300">
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Selected: {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)} ({formatRupiah(selectedSlot.price)})
                  </p>
                </div>
              )}

              <Button
                variant="primary"
                onClick={handleCreateHold}
                disabled={!selectedSlot || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Creating Hold...' : 'Create Booking Hold'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Booking Status Sidebar */}
        <div className="space-y-6">
          {activeHold ? (
            <Card className="border border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  Booking Hold Active
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <p className="text-slate-500">
                    <span className="font-semibold text-slate-600">Date:</span> {formatDate(activeHold.holdDate)}
                  </p>
                  <p className="text-slate-500">
                    <span className="font-semibold text-slate-600">Time:</span> {formatTimeDisplay(activeHold.startTime)} - {formatTimeDisplay(activeHold.endTime)}
                  </p>
                  <p className="text-slate-500">
                    <span className="font-semibold text-slate-600">Amount:</span> {formatRupiah(activeHold.price)}
                  </p>
                  <p className="text-slate-500">
                    <span className="font-semibold text-slate-600">Status:</span> {activeHold.status}
                  </p>
                  {countdown && (
                    <p className="text-amber-400 flex items-center gap-1">
                      <Timer className="w-4 h-4" />
                      Expires in: {countdown}
                    </p>
                  )}
                </div>

                {activeHold.status === 'ACTIVE' && (
                  <>
                    <Button
                      variant="primary"
                      onClick={openPaymentModal}
                      className="w-full"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Choose Payment Method
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleCancelHold}
                      className="w-full"
                    >
                      Cancel Hold
                    </Button>
                  </>
                )}

                {activeHold.status === 'CONVERTED' && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-sm text-emerald-300">Booking confirmed!</p>
                  </div>
                )}

                {activeHold.status === 'EXPIRED' && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                    <p className="text-sm text-rose-300">Booking hold expired.</p>
                  </div>
                )}

                {activeHold.status === 'CANCELLED' && (
                  <div className="p-3 bg-slate-500/10 border border-slate-500/20 rounded-lg">
                    <p className="text-sm text-slate-600">Booking hold cancelled.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-slate-900 glass">
              <CardContent className="pt-6">
                <p className="text-slate-500 text-sm">No active booking hold. Select a date and time slot to create one.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Payment Gateway Selection Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); setSelectedGateway(null); }} title="Choose Payment Method">
        <div className="space-y-4">
          {isLoadingGateways ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
              <span className="ml-3 text-sm text-slate-500">Loading gateways...</span>
            </div>
          ) : gateways.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm">No payment gateways available.</p>
            </div>
          ) : !selectedGateway ? (
            <>
              <p className="text-sm text-slate-500 mb-3">Select a payment method to complete your booking:</p>
              <div className="space-y-2">
                {gateways.map((gw) => (
                  <button
                    key={gw.id}
                    onClick={() => setSelectedGateway(gw)}
                    className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left flex items-center gap-3"
                  >
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{gw.name}</p>
                      {gw.description && <p className="text-xs text-slate-500">{gw.description}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Back to gateway selection */}
              <button onClick={() => setSelectedGateway(null)} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-2">
                ← Back
              </button>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-3">
                <p className="text-sm font-semibold text-indigo-900">{selectedGateway.name}</p>
              </div>

              {selectedGateway.name.toLowerCase().includes('pakasir') ? (
                <>
                  <p className="text-sm text-slate-500 mb-4">
                    You will be redirected to Pakasir to complete your payment of{' '}
                    <strong>{formatRupiah(activeHold?.price)}</strong> for the room rental.
                  </p>
                  <Button
                    variant="primary"
                    onClick={handleInitiatePakasir}
                    disabled={isInitiating}
                    className="w-full"
                  >
                    {isInitiating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Pay with Pakasir — {formatRupiah(activeHold?.price)}
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  {/* Manual transfer — upload payment proof */}
                  <div className="mb-3">
                    <label className="block text-sm font-semibold text-slate-600 mb-2">Upload Payment Proof</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 bg-white/60 border border-slate-200 rounded-lg text-slate-600 text-sm"
                    />
                    <p className="text-xs text-slate-400 mt-1">Accepts image or PDF</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={handlePaymentUpload}
                      disabled={!paymentFile || isUploading}
                      className="flex-1"
                    >
                      {isUploading ? 'Uploading...' : 'Upload Proof'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setIsPaymentModalOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Close button when no specific gateway selected */}
          {!selectedGateway && !isLoadingGateways && (
            <Button variant="secondary" onClick={() => { setIsPaymentModalOpen(false); setSelectedGateway(null); }} className="w-full mt-2">
              Cancel
            </Button>
          )}
        </div>
      </Modal>
    </>
  );
}
