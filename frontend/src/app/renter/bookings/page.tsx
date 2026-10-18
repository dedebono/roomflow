'use client';

/**
 * Riwayat pesanan renter.
 *
 * Versi lama menampilkan "BookingHold" dan punya tombol "Bayar Semua" yang
 * memanggil /payments/initiate-batch. Keduanya sudah dihapus di backend:
 *   - BookingHold tidak lagi ada (hold sekarang/status di Booking)
 *   - initiate-batch dihapus karena pembayaran batch melalui beberapa invoice
 *     terpisah tidak punya orderId+amount yang bisa dicocokkan saat webhook
 *     datang — verifikasi pembayaran jadi rapuh.
 *
 * Halaman ini sekarang-read-only: daftar Order milik user beserta status
 * pembayarannya. Pembayaran baru dilakukan dari halaman /renter/payments.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import toast from 'react-hot-toast';
import { CalendarCheck, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';

interface OrderRow {
  id: string;
  total: string | number;
  status: 'AWAITING_PAYMENT' | 'PAID' | 'EXPIRED';
  createdAt: string;
  items: Array<{
    id: string;
    startTime: string;
    endTime: string;
    priceSnapshot: string | number;
    booking?: { status: string; holdExpiresAt: string | null; settling: boolean };
  }>;
}

const STATUS_STYLE: Record<
  string,
  { label: string; tone: 'success' | 'danger' | 'info' | 'warning' | 'neutral' }
> = {
  AWAITING_PAYMENT: { label: 'Menunggu pembayaran', tone: 'warning' },
  PAID: { label: 'Lunas', tone: 'success' },
  EXPIRED: { label: 'Kedaluwarsa', tone: 'neutral' },
};

// Booking disimpan nominal-UTC: HH:MM pada ISO adalah jam yang diklik user.
// `new Date(iso).toLocaleTimeString()` mengonversi ke zona browser sehingga
// menggesernya (09:00 tampil 17:00 di WIB) dan renter datang pada jam
// yang salah. Baca substring langsung, jangan lewat Date.
const hhmm = (iso: string) => iso.substring(11, 16);
const fmtDay = (iso: string) =>
  new Date(new Date(iso).getTime() + 12 * 3600_000).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

export default function RenterBookingsPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // interceptor tidak unwrap: api.get selalu AxiosResponse.
      const { data } = await api.get<OrderRow[]>('/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat pesanan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }

  const paid = orders.filter((o) => o.status === 'PAID');
  const pending = orders.filter((o) => o.status === 'AWAITING_PAYMENT');
  const past = orders.filter((o) => o.status === 'EXPIRED');
  // Total = seluruh order, bukan hanya yang lunas. Menjumlahkan hanya
  // `paid` membuat halaman menampilkan "total Rp 0" padahal ada pesanan
  // Rp 200.000 — perceived bug yang sebenarnya summarise-kolom yang salah.
  const totalAll = orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Link href="/renter/rooms">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" /> Cari ruangan
        </Button>
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarCheck className="h-6 w-6" /> Pesanan Saya
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {orders.length} pesanan · {paid.length} lunas · total {formatRupiah(totalAll)}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setRefreshing(true); void load(); }} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Muat ulang
        </Button>
      </div>

      {pending.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-base">
              {pending.length} pesanan menunggu pembayaran
            </CardTitle>
            <CardDescription>
              Slot kamu hanya ditahan 15 menit. Selesaikan di halaman pembayaran.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/renter/payments">
              <Button>Buka halaman pembayaran</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada pesanan.{' '}
            <Link href="/renter/rooms" className="underline">Pilih ruangan</Link> untuk mulai.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {([['Akan datang', paid], ['Menunggu', pending], ['Selesai / kedaluwarsa', past]] as const).map(
            ([label, list]) =>
              list.length > 0 && (
                <div key={label} className="space-y-3">
                  <h2 className="font-semibold text-sm text-muted-foreground">{label}</h2>
                  {list.map((o) => {
                    const st = STATUS_STYLE[o.status] ?? { label: o.status, tone: 'neutral' as const };
                    return (
                      <Card key={o.id}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">
                                  {o.items?.length
                                    ? `${o.items.length} sesi`
                                    : 'Pesanan'}
                                </span>
                                <Badge variant={st.tone}>{st.label}</Badge>
                                {o.items?.[0]?.booking?.settling && (
                                  <Badge variant="info">Memverifikasi pembayaran</Badge>
                                )}
                              </div>
                              {/* Tanggal per baris, bukan satu header untuk semua
                                  item. Paket 4 sesi men campaigning 4 tanggal
                                  berbeda; hanya item[0] yang tampil membuat
                                  sesi 2/3/4 tak terlihat — renter tidak bisa
                                  cek hari mana yang sudah dibayar. */}
                              {o.items?.map((it) => (
                                <p key={it.id} className="text-sm text-muted-foreground">
                                  {fmtDay(it.startTime)} · {hhmm(it.startTime)}–{hhmm(it.endTime)} ·{' '}
                                  {formatRupiah(Number(it.priceSnapshot))}
                                </p>
                              ))}
                            </div>
                            <div className="text-right space-y-1">
                              <p className="font-semibold">{formatRupiah(Number(o.total))}</p>
                              {o.status === 'PAID' && (
                                <p className="text-xs text-emerald-600">Pembayaran diterima</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ),
          )}
        </div>
      )}
    </div>
  );
}