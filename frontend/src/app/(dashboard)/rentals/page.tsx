'use client';

/**
 * Dashboard admin/manager: daftar seluruh booking.
 *
 * Versi lama memakai /rentals/holds dan RentalHold — keduanya sudah dihapus
 * saat model hold dilebur ke Booking. Sekarang sumbernya GET /api/bookings,
 * yang mengembalikan Booking dengan status HELD / CONFIRMED / EXPIRED /
 * CANCELLED, plus kolom settling untuk kasus "menunggu verdict gateway".
 *
 * CATATAN OPERASI: halaman ini read-only. Admin tidak bisa mengetik status
 * pembayaran dari sini — konfirmasi hanya lewat webhook gateway yang sudah
 * diverifikasi. Cancel hanya mungkin untuk booking staff (source=INTERNAL);
 * booking rental yang sudah dibayar dilindungi server dan akan menolak.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import toast from 'react-hot-toast';
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface AdminBooking {
  id: string;
  roomId: string;
  userId: string;
  title: string | null;
  startTime: string;
  endTime: string;
  status: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  source: 'RENTAL' | 'INTERNAL';
  settling: boolean;
  holdExpiresAt: string | null;
  priceSnapshot: string | number | null;
  room?: { id: string; name: string } | null;
  user?: { id: string; name: string; email: string } | null;
}

const STATUS_STYLE: Record<
  string,
  { label: string; tone: 'success' | 'danger' | 'info' | 'warning' | 'neutral' }
> = {
  CONFIRMED: { label: 'Terbayar', tone: 'success' },
  HELD: { label: 'Ditahan (menunggu bayar)', tone: 'warning' },
  EXPIRED: { label: 'Kedaluwarsa', tone: 'neutral' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
};

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function AdminRentalsPage() {
  const [rows, setRows] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'HELD' | 'CONFIRMED'>('all');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<AdminBooking[]>('/bookings?limit=200');
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat booking.');
    } finally {
      setLoading(false);
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

  const held = rows.filter((b) => b.status === 'HELD');
  const confirmed = rows.filter((b) => b.status === 'CONFIRMED');
  const settling = rows.filter((b) => b.settling);
  const shown = filter === 'all' ? rows : rows.filter((b) => b.status === filter);

  return (
    <DashboardLayout
      title="Booking"
      description="Seluruh booking — ditahan, terbayar, dan yang sedang diverifikasi gateway."
      allowedRoles={['ADMIN_IT', 'ROOM_ADMIN']}
    >
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Booking</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {rows.length} booking · {confirmed.length} terbayar · {held.length} ditahan
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Muat ulang
        </Button>
      </div>

      {settling.length > 0 && (
        <Card className="border-blue-300 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {settling.length} booking sedang diverifikasi ke gateway
            </CardTitle>
            <CardDescription>
              Slot tetap dikunci sampai gateway memberi jawaban. Ini fail-closed: kalau
              gateway tidak bisa dihubungi, slot TIDAK dilepas agar tidak ada pembayaran
              yang mendarat di slot kosong.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="flex gap-2">
        {([['all', 'Semua'], ['HELD', 'Ditahan'], ['CONFIRMED', 'Terbayar']] as const).map(
          ([k, label]) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? 'primary' : 'secondary'}
              onClick={() => setFilter(k)}
            >
              {label}
            </Button>
          ),
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {shown.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">Tidak ada booking.</p>
          ) : (
            <div className="divide-y">
              {shown.map((b) => {
                const st = STATUS_STYLE[b.status] ?? { label: b.status, tone: 'neutral' as const };
                return (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{b.room?.name ?? b.roomId.slice(0, 8)}</span>
                        <Badge variant={st.tone}>{st.label}</Badge>
                        {b.source === 'INTERNAL' && <Badge variant="info">Internal</Badge>}
                        {b.settling && <Badge variant="warning">Verifikasi gateway</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {fmtDate(b.startTime)} · {hhmm(b.startTime)}–{hhmm(b.endTime)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.user?.name ?? b.userId.slice(0, 8)}
                        {b.user?.email ? ` · ${b.user.email}` : ''}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      {b.priceSnapshot != null && (
                        <p className="font-medium">{formatRupiah(Number(b.priceSnapshot))}</p>
                      )}
                      {b.status === 'CONFIRMED' && (
                        <p className="text-xs text-emerald-600 flex items-center justify-end gap-1">
                          <CheckCircle className="h-3 w-3" /> Sudah dibayar
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}