'use client';

/**
 * Sewa berkala + banyak ruangan sekaligus.
 *
 * Dua kebutuhan renter dijawab di satu halaman:
 *   1. menyewa BERKALA — tiap minggu / tiap 2 minggu / hari tertentu,
 *      selama berapa lama yang user pilih sendiri.
 *   2. menyewa BANYAK RUANGAN — centang beberapa ruangan, semuanya
 *      dijadwalkan dengan pola yang sama dalam satu klik.
 *
 * Semua perhitungan tanggal terjadi di BACKEND (POST /series/preview).
 * Frontend tidak menebak-nebak tanggal: kalau server yang menghitung,
 * harga yang tampil di layar dijamin sama dengan yang ditagih.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api, { getImageUrl } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Repeat,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface Room {
  id: string;
  name: string;
  description?: string;
  category?: string;
  capacity?: number;
  imageUrl?: string;
}

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  available: boolean;
}

interface PreviewLine {
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  price: number;
}

interface RejectedLine {
  roomId: string;
  roomName: string;
  startTime: string;
  code: string;
  message: string;
}

interface Preview {
  sessions: number;
  rooms: number;
  total: number;
  lines: PreviewLine[];
  rejected: RejectedLine[];
  firstStart: string;
  lastEnd: string;
}

type Pattern = 'ONCE' | 'WEEKLY' | 'BIWEEKLY' | 'CUSTOM';

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

// Jam dinding dibaca langsung dari substring ISO. Booking disimpan
// nominal-UTC (lihat catatan timezone di schema.prisma), jadi
// new Date(...).toLocaleTimeString() akan menggeser jamnya.
const hhmm = (iso: string) => iso.substring(11, 16);
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  // shifted by noon to dodge any TZ edge
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)).toLocaleDateString(
    'id-ID',
    { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' },
  );
};

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

const todayIso = () => new Date().toISOString().substring(0, 10);

export default function BulkBookingPage() {
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  const [date, setDate] = useState<string>(todayIso());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotId, setSlotId] = useState<string | null>(null);

  const [pattern, setPattern] = useState<Pattern>('ONCE');
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [occurrences, setOccurrences] = useState(4);
  const [endMode, setEndMode] = useState<'count' | 'date'>('count');
  const [until, setUntil] = useState<string>(addDaysIso(todayIso(), 90));

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/rentals/available-rooms');
        const list: Room[] = Array.isArray(data) ? data : (data?.data ?? []);
        setRooms(list);
      } catch {
        toast.error('Gagal memuat daftar ruangan.');
      } finally {
        setLoadingRooms(false);
      }
    })();
  }, []);

  const loadSlots = useCallback(async (roomId: string, d: string) => {
    setLoadingSlots(true);
    setSlotId(null);
    try {
      // Slot diambil dari ruangan PERTAMA yang dipilih. Ruangan bisa punya
      // jam sewa berbeda; preview di bawah yang memvalidasi satu per satu,
      // jadi ruangan yang tidak cocok akan muncul di daftar "tidak tersedia".
      const { data } = await api.get('/rentals/available-slots', {
        params: { roomId, date: d },
      });
      setSlots(data ?? []);
    } catch {
      toast.error('Gagal memuat jadwal.');
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  // Slot dimuat lewat EFFECT, bukan dari dalam toggleRoom. Kalau dipanggil
  // di event handler, loadSlots masih memegang `selected` versi lama — jadi
  // memilih ruangan pertama (selected masih []) selalu melihat array kosong
  // dan tidak pernah memuat slot sama sekali.
  useEffect(() => {
    const first = selected[0];
    if (!first || !date) {
      setSlots([]);
      return;
    }
    void loadSlots(first, date);
  }, [selected[0], date, loadSlots]);

  const toggleRoom = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
    setPreview(null);
  };

  const slot = slots.find((s) => s.id === slotId) ?? null;

  const series = useMemo(() => {
    const base: any = { pattern };
    if (pattern === 'WEEKLY') base.intervalWeeks = intervalWeeks;
    if (pattern === 'CUSTOM') {
      base.intervalWeeks = intervalWeeks;
      base.daysOfWeek = daysOfWeek;
    }
    if (endMode === 'count') base.occurrences = occurrences;
    else base.until = until;
    return base;
  }, [pattern, intervalWeeks, daysOfWeek, endMode, occurrences, until]);

  const runPreview = useCallback(async () => {
    if (selected.length === 0 || !slot) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const { data } = await api.post<Preview>('/series/preview', {
        roomIds: selected,
        startTime: slot.startTime,
        endTime: slot.endTime,
        series,
      });
      setPreview(data);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Gagal menghitung paket.';
      setPreviewError(msg);
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }, [selected, slot, series]);

  useEffect(() => {
    setPreview(null);
  }, [pattern, intervalWeeks, daysOfWeek, endMode, occurrences, until, selected, slotId]);

  const addToCart = async () => {
    if (!slot || selected.length === 0) return;
    setAdding(true);
    try {
      const { data } = await api.post('/series/cart', {
        roomIds: selected,
        startTime: slot.startTime,
        endTime: slot.endTime,
        series,
      });
      const n = data?.added ?? 0;
      const dup = data?.duplicates ?? 0;
      if (n > 0) {
        toast.success(`${n} sesi ditambahkan ke keranjang.`);
      }
      if (dup > 0) {
        toast(`${dup} sesi sudah ada di keranjang, dilewati.`);
      }
      if (data?.rejected?.length) {
        toast.error(`${data.rejected.length} sesi tidak bisa dijadwalkan.`);
      }
      router.push('/renter/cart');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Gagal menambahkan ke keranjang.');
    } finally {
      setAdding(false);
    }
  };

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/renter/rooms">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Daftar ruangan
          </Button>
        </Link>
        <Link href="/renter/cart">
          <Button variant="secondary" size="sm">
            <ShoppingCart className="h-4 w-4 mr-2" /> Keranjang
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Repeat className="h-6 w-6" /> Sewa Berkala & Banyak Ruangan
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pilih beberapa ruangan, atur pola pengulangannya, lalu masukkan semuanya ke keranjang
          sekaligus.
        </p>
      </div>

      {/* 1. Ruangan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Pilih ruangan</CardTitle>
          <CardDescription>
            Bisa pilih lebih dari satu. Semua ruangan memakai jadwal yang sama.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRooms ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada ruangan yang bisa disewa.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => {
                const on = selected.includes(room.id);
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => toggleRoom(room.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      on
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/60'
                    }`}
                  >
                    {room.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getImageUrl(room.imageUrl)}
                        alt={room.name}
                        className="h-12 w-12 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted/40 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{room.name}</p>
                      {room.capacity && (
                        <p className="text-xs text-muted-foreground">{room.capacity} orang</p>
                      )}
                    </div>
                    {on && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 ml-auto" />}
                  </button>
                );
              })}
            </div>
          )}
          {selected.length > 0 && (
            <p className="text-sm text-muted-foreground mt-3">
              {selected.length} ruangan dipilih.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2. Slot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> 2. Tanggal & jam
          </CardTitle>
          <CardDescription>
            Tanggal pertama jadi sesi nomor satu. Jam yang dipilih dipakai untuk semua sesi
            berikutnya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="date"
            value={date}
            min={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />

          {selected.length === 0 && (
            <p className="text-sm text-muted-foreground">Pilih ruangan dulu di langkah 1.</p>
          )}
          {selected.length > 0 && loadingSlots && (
            <p className="text-sm text-muted-foreground">Memuat jadwal…</p>
          )}
          {selected.length > 0 && !loadingSlots && slots.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tidak ada jadwal sewa pada tanggal ini untuk ruangan pertama.
            </p>
          )}

          {slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={!s.available}
                  // Slot nonaktif tanpa penjelasan: user menekan tombol mati
                  // dan tidak tahu kenapa. Satu atribut native sudah cukup.
                  title={s.available ? undefined : 'Sudah dipesan'}
                  aria-label={
                    s.available
                      ? `${hhmm(s.startTime)}-${hhmm(s.endTime)}`
                      : `${hhmm(s.startTime)}-${hhmm(s.endTime)} — Sudah dipesan`
                  }
                  onClick={() => setSlotId(s.id)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    !s.available
                      ? 'border-border bg-muted/40 text-muted-foreground line-through cursor-not-allowed'
                      : slotId === s.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary'
                  }`}
                >
                  {hhmm(s.startTime)}–{hhmm(s.endTime)}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Pola */}
      {slot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Repeat className="h-4 w-4" /> 3. Pola pengulangan
            </CardTitle>
            <CardDescription>Tentukan seberapa sering ruangan ini disewa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              {(
                [
                  { v: 'ONCE', l: 'Sekali saja' },
                  { v: 'WEEKLY', l: 'Tiap minggu' },
                  { v: 'BIWEEKLY', l: 'Tiap 2 minggu' },
                  { v: 'CUSTOM', l: 'Hari tertentu' },
                ] as { v: Pattern; l: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setPattern(opt.v)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    pattern === opt.v
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            {pattern === 'CUSTOM' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Hari yang dipilih
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((name, idx) => {
                    const d = idx + 1;
                    const on = daysOfWeek.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={`h-10 w-12 rounded-md border text-sm transition-colors ${
                          on
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {pattern !== 'ONCE' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Berulang setiap
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setIntervalWeeks(w)}
                      className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                        intervalWeeks === w
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary'
                      }`}
                    >
                      {w} minggu
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pattern !== 'ONCE' && (
              <div className="space-y-2">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={endMode === 'count'}
                      onChange={() => setEndMode('count')}
                    />
                    sejumlah sesi
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={endMode === 'date'}
                      onChange={() => setEndMode('date')}
                    />
                    sampai tanggal
                  </label>
                </div>
                {endMode === 'count' ? (
                  <input
                    type="number"
                    min={1}
                    max={400}
                    value={occurrences}
                    onChange={(e) => setOccurrences(Math.max(1, Number(e.target.value) || 1))}
                    className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    type="date"
                    value={until}
                    min={date}
                    onChange={(e) => setUntil(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                )}
              </div>
            )}

            <Button onClick={runPreview} disabled={previewing} variant="secondary">
              {previewing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CalendarDays className="h-4 w-4 mr-2" />
              )}
              Hitung paket
            </Button>

            {pattern === 'CUSTOM' && daysOfWeek.length === 0 && (
              <p className="text-sm text-amber-600">Pilih minimal satu hari.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Ringkasan paket</CardTitle>
            <CardDescription>
              {preview.sessions} sesi × {preview.rooms} ruangan = {preview.lines.length} booking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Periode</span>
              <span>
                {fmtDate(preview.firstStart)} – {fmtDate(preview.lastEnd)}
              </span>
            </div>

            {preview.rejected.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {preview.rejected.length} sesi tidak bisa dijadwalkan
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground max-h-32 overflow-auto">
                  {preview.rejected.slice(0, 20).map((r, i) => (
                    <li key={i}>
                      {fmtDate(r.startTime)} · {r.roomName} — {r.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="max-h-56 overflow-auto rounded-md border border-border">
              {preview.lines.slice(0, 60).map((l, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm px-3 py-2 border-b border-border last:border-0"
                >
                  <span>
                    {fmtDate(l.startTime)} · {l.roomName}
                    <span className="text-muted-foreground ml-2">
                      {hhmm(l.startTime)}–{hhmm(l.endTime)}
                    </span>
                  </span>
                  <span>{formatRupiah(l.price)}</span>
                </div>
              ))}
              {preview.lines.length > 60 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  … dan {preview.lines.length - 60} sesi lainnya
                </div>
              )}
            </div>

            <div className="flex justify-between font-semibold text-lg border-t pt-3">
              <span>Total</span>
              <span>{formatRupiah(preview.total)}</span>
            </div>

            <Button className="w-full" size="lg" onClick={addToCart} disabled={adding}>
              {adding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4 mr-2" />
              )}
              Masukkan {preview.lines.length} sesi ke keranjang
            </Button>
            <p className="text-xs text-muted-foreground">
              Semua sesi dibayar dalam satu invoice saat checkout. Slot baru dikunci saat Checkout,
              berlaku 15 menit.
            </p>
          </CardContent>
        </Card>
      )}

      {previewError && (
        <Card className="border-red-500/40">
          <CardContent className="flex items-start gap-2 py-4">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-600">{previewError}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Periksa pola pengulangan, jumlah sesi, atau jam yang dipilih.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}