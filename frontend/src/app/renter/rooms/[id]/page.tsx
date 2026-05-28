'use client';

import React, { useState, useEffect, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/api';
import { Room, RentalSlot, BookingHold } from '@/types';
import toast from 'react-hot-toast';
import { Calendar, Clock, Users, MapPin, Wifi, Monitor, Coffee, ArrowLeft, Upload, CheckCircle, XCircle, Timer } from 'lucide-react';
import Link from 'next/link';

interface TimeSlot {
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
      // Normalise amenities (may be JSON string or array) and imageUrl (may need origin prefix)
      const normalized = {
        ...data,
        amenities: Array.isArray(data.amenities)
          ? data.amenities
          : typeof data.amenities === 'string'
            ? data.amenities.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [],
        imageUrl: data.imageUrl
          ? (data.imageUrl.startsWith('http') ? data.imageUrl : `${window.location.origin}${data.imageUrl}`)
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
      // No active hold
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

  // Attach native event listener to date input (React synthetic events don't always fire for date inputs)
  useEffect(() => {
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (!dateInput) return;

    const handleNativeDateChange = () => {
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

    dateInput.addEventListener('change', handleNativeDateChange);
    dateInput.addEventListener('input', handleNativeDateChange);
    return () => {
      dateInput.removeEventListener('change', handleNativeDateChange);
      dateInput.removeEventListener('input', handleNativeDateChange);
    };
  }, [fetchTimeSlots]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchRoom();
      await fetchActiveHold();
      setLoading(false);
    };
    init();
  }, [fetchRoom, fetchActiveHold]);

  const fetchTimeSlotsRef = useRef<(date: string) => Promise<void>>();

  useEffect(() => {
    fetchTimeSlotsRef.current = fetchTimeSlots;
  }, [fetchTimeSlots]);

  // Attach native event listener to date input (React synthetic events don't always fire for date inputs)
  useEffect(() => {
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (!dateInput) return;

    const handleDateChange = () => {
      const date = dateInput.value;
      console.log('[native listener] date:', date);
      setSelectedDate(date);
      setSelectedSlot(null);
      if (date && fetchTimeSlotsRef.current) {
        useEffect(() => {
          const init = async () => {
            setLoading(true);
            await fetchRoom();
            await fetchActiveHold();
            setLoading(false);
          };
          init();
        }, [fetchRoom, fetchActiveHold]);

        const fetchTimeSlotsRef = useRef<(date: string) => Promise<void>>();

        useEffect(() => {
          fetchTimeSlotsRef.current = fetchTimeSlots;
        }, [fetchTimeSlots]);

        // Attach native event listener to date input
        useEffect(() => {
          const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
          if (!dateInput) {
            console.error('[useEffect] Date input not found!');
            return;
          }

          const handleNativeChange = () => {
            const date = dateInput.value;
            console.log('[native listener] date changed:', date);
            setSelectedDate(date);
            setSelectedSlot(null);
            if (date && fetchTimeSlotsRef.current) {
              fetchTimeSlotsRef.current(date);
            } else {
              setTimeSlots([]);
            }
          };

          dateInput.addEventListener('change', handleNativeChange);
          dateInput.addEventListener('input', handleNativeDateChange); // Trigger on input as well

          // Cleanup listener on unmount
          return () => {
            dateInput.removeEventListener('change', handleNativeChange);
            dateInput.removeEventListener('input', handleNativeDateChange);
          };
        }, []); // Empty dependency array: run once on mount

        useEffect(() => {
          const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
          if (!dateInput) {
            console.error('[useEffect] Date input not found!');
            return;
          }

          const handleNativeChange = () => {
            const date = dateInput.value;
            console.log('[native listener] date changed:', date);
            setSelectedDate(date);
            setSelectedSlot(null);
            if (date && fetchTimeSlots) {
              fetchTimeSlots(date);
            } else {
              setTimeSlots([]);
            }
          };

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
            if (!dateInput) {
              console.error('[useEffect] Date input not found!');
              return;
            }

            const handleNativeChange = () => {
              const date = dateInput.value;
              console.log('[native listener] date changed:', date);
              setSelectedDate(date);
              setSelectedSlot(null);
              if (date && fetchTimeSlots) {
                fetchTimeSlots(date);
              } else {
                setTimeSlots([]);
              }
            };

            useEffect(() => {
              // Handle date change
              const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const date = e.target.value;
                console.log('[React onChange] date changed to:', date);
                setSelectedDate(date);
                setSelectedSlot(null);
                if (date) {
                  fetchTimeSlots(date);
                } else {
                  setTimeSlots([]);
                }
              };
  };

  // Create booking hold
  const handleCreateHold = async () => {
    if (!selectedSlot || !selectedDate) {
      toast.error('Please select a date and time slot');
      return;
    }

    setIsSubmitting(true);
    try {
      // Extract HH:MM from ISO string (e.g., "2026-05-29T09:00:00.000Z" -> "09:00")
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
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  min={new Date().toISOString().split('T')[0]}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-slate-900/60 hover:bg-slate-900/80 focus:bg-slate-950 text-slate-100 text-sm rounded-lg border border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 px-3.5 py-2.5 transition-all duration-200 focus:ring-4 outline-none"
                />
              </div>

              {selectedDate && (
                <>
                  {timeSlots.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                      {timeSlots.map((slot, idx) => (
                        <button
                          key={idx}
                          disabled={!slot.available}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                            selectedSlot === slot
                              ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                              : slot.available
                              ? 'border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white'
                              : 'border-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{slot.startTime} - {slot.endTime}</span>
                            <span className="text-xs opacity-70">${slot.price}/hr</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm text-center py-4">No time slots available for this date</p>
                  )}
                </>
              )}

              {selectedSlot && (
                <div className="flex items-center gap-3 pt-4 border-t border-slate-800/40">
                  <div className="flex-1 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-sm text-indigo-300 font-semibold">
                      Selected: {selectedSlot.startTime} - {selectedSlot.endTime}
                    </p>
                    <p className="text-xs text-slate-400">Total: ${selectedSlot.price}</p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleCreateHold}
                    isLoading={isSubmitting}
                  >
                    Book Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Booking Status Sidebar */}
        <div className="space-y-6">
          {/* Active Hold Status */}
          {activeHold && (
            <Card className={`border ${
              activeHold.status === 'ACTIVE' ? 'border-amber-500/30 bg-amber-500/5' :
              activeHold.status === 'CONVERTED' ? 'border-emerald-500/30 bg-emerald-500/5' :
              'border-slate-700/50 bg-slate-800/30'
            } glass`}>
              <CardHeader className="p-0 mb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {activeHold.status === 'ACTIVE' && <Timer className="w-5 h-5 text-amber-400" />}
                  {activeHold.status === 'CONVERTED' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                  {activeHold.status === 'EXPIRED' && <XCircle className="w-5 h-5 text-slate-400" />}
                  Booking Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Badge
                  variant={
                    activeHold.status === 'ACTIVE' ? 'warning' :
                    activeHold.status === 'CONVERTED' ? 'success' : 'neutral'
                  }
                >
                  {activeHold.status === 'ACTIVE' ? 'Waiting for Payment' :
                   activeHold.status === 'CONVERTED' ? 'Confirmed' :
                   activeHold.status}
                </Badge>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Room:</span>
                    <span className="text-slate-200 font-medium">{room.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date:</span>
                    <span className="text-slate-200 font-medium">{new Date(activeHold.holdDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Time:</span>
                    <span className="text-slate-200 font-medium">{activeHold.startTime} - {activeHold.endTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price:</span>
                    <span className="text-slate-200 font-medium">${activeHold.price}</span>
                  </div>
                </div>

                {activeHold.status === 'ACTIVE' && (
                  <>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-400 font-semibold text-center">
                        Time Remaining: {countdown}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        className="flex-1"
                        onClick={() => setIsPaymentModalOpen(true)}
                      >
                        <Upload className="w-4 h-4" />
                        Upload Payment
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCancelHold}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}

                {activeHold.status === 'CONVERTED' && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-emerald-300 font-semibold">Booking Confirmed!</p>
                    <p className="text-xs text-emerald-400/70 mt-1">Your booking has been approved</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Info Card */}
          <Card className="border border-slate-900 glass">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-sm text-slate-400">Rental Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-indigo-400 mt-0.5" />
                <div>
                  <p className="text-slate-300 font-medium">Hourly Rentals</p>
                  <p className="text-slate-500 text-xs">Book by the hour with flexible scheduling</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Timer className="w-4 h-4 text-indigo-400 mt-0.5" />
                <div>
                  <p className="text-slate-300 font-medium">1-Hour Hold</p>
                  <p className="text-slate-500 text-xs">Complete payment within 1 hour to confirm</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Upload Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Upload Payment Proof"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Please transfer the payment of <span className="text-white font-semibold">${activeHold?.price}</span> to the designated account and upload the receipt below.
          </p>

          <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5">
            <p className="text-xs text-indigo-300">
              <strong>Payment Instructions:</strong><br />
              Bank: Demo Bank<br />
              Account: 1234-5678-9012<br />
              Name: RoomFlow Rentals
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
              Payment Receipt / Screenshot
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/20 file:text-indigo-300 hover:file:bg-indigo-500/30 cursor-pointer"
            />
          </div>

          {paymentFile && (
            <div className="p-3 rounded-lg bg-slate-800/50">
              <p className="text-sm text-slate-300">Selected: {paymentFile.name}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handlePaymentUpload}
              isLoading={isUploading}
              disabled={!paymentFile}
            >
              <Upload className="w-4 h-4" />
              Submit Payment
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
