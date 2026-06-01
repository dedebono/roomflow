'use client';

import React, { useState, useEffect, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import api, { getImageUrl } from '@/lib/api';
import { Room, RentalSlot, BookingHold } from '@/types';
import toast from 'react-hot-toast';
import { Calendar, Clock, Users, MapPin, Wifi, Monitor, Coffee, ArrowLeft, Upload, CheckCircle, XCircle, Timer } from 'lucide-react';
import Link from 'next/link';

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  available: boolean;
}

export default function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const roomId = resolvedParams.id;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [activeHold, setActiveHold] = useState<BookingHold | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
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

  // Fetch available time slots for selected date
  const fetchTimeSlots = useCallback(async (date: string) => {
    if (!date) return;
    try {
      console.log('[fetchTimeSlots] roomId:', roomId, 'date:', date);
      const res = await api.get(`/rentals/available-slots`, {
        params: { roomId, date },
      });
      console.log('[fetchTimeSlots] response:', res.data);
      setTimeSlots(res.data);
    } catch (err) {
      console.error('[fetchTimeSlots] error:', err);
      toast.error('Failed to load available time slots');
    }
  }, [roomId]);

  // Fetch active booking hold for this room
  const fetchActiveHold = useCallback(async () => {
    try {
      const res = await api.get(`/rentals/active-hold`, {
        params: { roomId },
      });
      setActiveHold(res.data);
    } catch {
      setActiveHold(null);
    }
  }, [roomId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchRoom();
      await fetchActiveHold();
      setLoading(false);
    };
    init();
  }, [fetchRoom, fetchActiveHold]);

  // Attach native event listener to date input
  useEffect(() => {
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (!dateInput) return;

    const handleDateChange = () => {
      const date = dateInput.value;
      console.log('[native date listener] date changed to:', date);
      setSelectedDate(date);
      setSelectedSlot(null);
      if (date) {
        fetchTimeSlots(date);
      } else {
        setTimeSlots([]);
      }
    };

    dateInput.addEventListener('change', handleDateChange);
    dateInput.addEventListener('input', handleDateChange);
    return () => {
      dateInput.removeEventListener('change', handleDateChange);
      dateInput.removeEventListener('input', handleDateChange);
    };
  }, [fetchTimeSlots]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
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
    } catch {
      toast.error('Failed to cancel booking hold');
    }
  };

  // Upload payment proof
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
  const getAmenities = (amenitiesStr?: string) => {
    if (!amenitiesStr) return [];
    try {
      return JSON.parse(amenitiesStr);
    } catch {
      return amenitiesStr.split(',').map((s: string) => s.trim());
    }
  };

  const amenities = room?.amenities || [];

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
          <p className="text-slate-400">Room not found.</p>
          <Link href="/renter/rooms" className="mt-4 inline-block">
            <Button variant="secondary">Back to Rooms</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Back Button */}
      <Link href="/renter/rooms" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-semibold">Back to Rooms</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Room Image */}
          <Card className="border border-slate-900 glass overflow-hidden">
            <div className="relative h-64 bg-slate-900">
              {room.imageUrl ? (
                <img
                  src={room.imageUrl}
                  alt={room.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <MapPin className="w-16 h-16" />
                </div>
              )}
              <div className="absolute top-4 right-4 flex gap-2">
                <Badge variant={room.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {room.status}
                </Badge>
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
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Up to {room.capacity} guests
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  {room.building?.name || 'Building'}
                </span>
              </div>

              {room.description && (
                <p className="text-slate-300 text-sm">{room.description}</p>
              )}

              {/* Amenities */}
              {amenities.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {amenities.map((amenity: string, idx: number) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 text-slate-300 text-xs rounded-full"
                    >
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
                <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                  Rental Date
                </label>
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
                  className="w-full bg-slate-900/60 hover:bg-slate-900/80 focus:bg-slate-950 text-slate-100 text-sm rounded-lg border border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 px-3.5 py-2.5 transition-all duration-200 focus:ring-4 outline-none"
                />
              </div>

              {selectedDate && (
                <>
                  {timeSlots.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-300 tracking-wide uppercase">Available Time Slots</p>
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
                                  ? 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-60 line-through'
                                  : 'bg-slate-800/40 border-slate-700/50 text-slate-200 hover:border-indigo-500/50 hover:bg-slate-800 hover:scale-[1.02]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-200' : 'text-indigo-400'}`} />
                              <span>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                            </div>
                            <div className={`text-xs font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                              ${slot.price}
                            </div>
                            {isDisabled && (
                              <div className="mt-1 text-[10px] uppercase font-bold text-rose-500/80">Booked</div>
                            )}
                          </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No available time slots for this date.</p>
                  )}
                </>
              )}

              {selectedSlot && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <p className="text-sm text-indigo-300">
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Selected: {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)} (${selectedSlot.price})
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
                  <p className="text-slate-400">
                    <span className="font-semibold text-slate-300">Date:</span> {activeHold.holdDate}
                  </p>
                  <p className="text-slate-400">
                    <span className="font-semibold text-slate-300">Time:</span> {activeHold.startTime} - {activeHold.endTime}
                  </p>
                  <p className="text-slate-400">
                    <span className="font-semibold text-slate-300">Amount:</span> ${activeHold.price}
                  </p>
                  <p className="text-slate-400">
                    <span className="font-semibold text-slate-300">Status:</span> {activeHold.status}
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
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Payment Proof
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
                    <p className="text-sm text-slate-300">Booking hold cancelled.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-slate-900 glass">
              <CardContent className="pt-6">
                <p className="text-slate-400 text-sm">No active booking hold. Select a date and time slot to create one.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Upload Payment Proof">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Payment Proof File</label>
            <input
              type="file"
              onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-300"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handlePaymentUpload}
              disabled={!paymentFile || isUploading}
              className="flex-1"
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsPaymentModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
