'use client';

/**
 * Detail ruangan untuk renter.
 *
 * ALUR YANG BENAR: pilih slot -> masukkan ke KERANJANG -> checkout.
 *
 * Versi lama membuat "booking hold" begitu slot diklik (POST /rentals/create-hold).
 * Itu melanggar keputusan desain: keranjang bukan reservasi, dan kunci slot baru
 * dibuat saat checkout. Akibatnya slot terkunci sebelum ada niat membayar, dan
 * satu orang bisa membekukan ruangan berjam-jam hanya dengan membuka halaman.
 *
 * Di halaman ini TIDAK ADA lagi:
 *   - create-hold / cancel hold (slot hanya dilepas backend, bukan dari browser)
 *   - upload bukti transfer (konfirmasi hanya dari webhook gateway)
 *   - tombol initiate payment terpisah (checkout sudah membuat invoice)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api, { getImageUrl } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Room } from '@/types';
import toast from 'react-hot-toast';
import { Users, CalendarDays, Clock, ShoppingCart, ArrowLeft, Loader2 } from 'lucide-react';

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  available: boolean;
}

const hhmm = (iso: string) => iso.substring(11, 16);

export default function RoomDetailPage() {
  const router = useRouter();
  const { id: roomId } = useParams<{ id: string }>();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const fetchRoom = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/rooms/${roomId}`);
      setRoom({
        ...d,
        amenities: Array.isArray(d.amenities)
          ? d.amenities
          : typeof d.amenities === 'string'
            ? d.amenities.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [],
        imageUrl: d.imageUrl ? getImageUrl(d.imageUrl) : undefined,
      });
    } catch {
      toast.error('Gagal memuat detail ruangan.');
      router.push('/renter/rooms');
    }
  }, [roomId, router]);

  const fetchCartCount = useCallback(async () => {
    try {
      // interceptor tidak unwrap: api.get selalu AxiosResponse.
      const { data } = await api.get('/cart');
      setCartCount(data?.total ?? 0);
    } catch {
      setCartCount(0);
    }
  }, []);

  const fetchTimeSlots = useCallback(async (date: string) => {
    if (!date) return;
    setLoadingSlots(true);
    try {
      const { data } = await api.get('/rentals/available-slots', { params: { roomId, date } });
      setTimeSlots(data ?? []);
      setSelectedSlots([]);
    } catch {
      toast.error('Gagal memuat jadwal.');
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [roomId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchRoom();
      await fetchCartCount();
      setLoading(false);
    })();
  }, [fetchRoom, fetchCartCount]);

  const total = useMemo(
    () => selectedSlots.reduce((sum, s) => sum + Number(s.price || 0), 0),
    [selectedSlots],
  );

  const toggleSlot = (slot: TimeSlot) => {
    setSelectedSlots((prev) =>
      prev.some((s) => s.id === slot.id)
        ? prev.filter((s) => s.id !== slot.id)
        : [...prev, slot].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    );
  };

  /**
   * Masukkan ke keranjang. TIDAK mengunci slot apa pun — hanya catatan.
   * Kalau slot sudah diambil orang lain, keranjang tetap boleh|SchEDULE ini
   * akan ditolak saat checkout, bukan sekarang.
   */
  const addToCart = async () => {
    if (selectedSlots.length === 0) return;
    setAdding(true);
    try {
      for (const slot of selectedSlots) {
        await api.post('/cart/items', {
          roomId,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
      toast.success(`${selectedSlots.length} slot dimasukkan ke keranjang.`);
      setSelectedSlots([]);
      await fetchCartCount();
      // Muat ulang slot supaya yang baru terpakai kelihatan tidak tersedia.
      if (selectedDate) await fetchTimeSlots(selectedDate);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Gagal menambahkan ke keranjang.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }
  if (!room) return null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/renter/rooms">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
          </Button>
        </Link>
        <Link href="/renter/cart">
          <Button variant="secondary" size="sm">
            <ShoppingCart className="h-4 w-4 mr-2" /> Keranjang
            {cartCount > 0 && <Badge className="ml-2">{cartCount}</Badge>}
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {room.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={room.imageUrl}
              alt={room.name}
              className="w-full h-56 object-cover rounded-lg"
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>{room.name}</CardTitle>
              <CardDescription>{room.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              {room.capacity && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" /> {room.capacity} orang
                </div>
              )}
              {room.maxBookingHours && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" /> Maks {room.maxBookingHours} jam per booking
                </div>
              )}
              {room.rentalSlots && room.rentalSlots.length > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {room.rentalSlots.length} jadwal sewa
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" /> Pilih jadwal
              </CardTitle>
              <CardDescription>
                Slot yang sudah dipesan tidak bisa dipilih. Keranjang tidak mengunci slot —
                slot baru dikunci saat kamu menekan Checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  void fetchTimeSlots(e.target.value);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />

              {loadingSlots && (
                <p className="text-sm text-muted-foreground">Memuat jadwal…</p>
              )}

              {selectedDate && !loadingSlots && timeSlots.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Tidak ada jadwal sewa pada tanggal ini.
                </p>
              )}

              {timeSlots.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {timeSlots.map((slot) => {
                    const picked = selectedSlots.some((s) => s.id === slot.id);
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!slot.available}
                        title={slot.available ? undefined : 'Sudah dipesan'}
                        onClick={() => toggleSlot(slot)}
                        className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                          !slot.available
                            ? 'border-border bg-muted/40 text-muted-foreground line-through cursor-not-allowed'
                            : picked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary'
                        }`}
                      >
                        {hhmm(slot.startTime)}–{hhmm(slot.endTime)}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Ringkasan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada slot dipilih. Pilih tanggal lalu slot yang tersedia.
                </p>
              ) : (
                <>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {selectedSlots.map((s) => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span>
                          {hhmm(s.startTime)}–{hhmm(s.endTime)}
                        </span>
                        <span className="text-muted-foreground">{formatRupiah(Number(s.price))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-t pt-3 font-semibold">
                    <span>Total</span>
                    <span>{formatRupiah(total)}</span>
                  </div>
                  <Button className="w-full" onClick={addToCart} disabled={adding}>
                    {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Masukkan ke keranjang
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Slot baru dikunci saat Checkout dan berlaku 15 menit.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}