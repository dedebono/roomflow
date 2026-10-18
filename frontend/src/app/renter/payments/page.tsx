'use client';

/**
 * Halaman pembayaran renter.
 *
 * Alur: keranjang -> POST /checkout (hold HELD 15 menit) -> bayar via Pakasir
 * -> webhook terverifikasi -> CONFIRMED.
 *
 * Tiga hal yang TIDAK boleh ada di halaman ini, karena ketiganya pernah jadi
 * lubang di versi lama:
 *
 *   1. TIDAK ADA upload bukti transfer. Konfirmasi hanya dari webhook gateway
 *      yang diverifikasi; kalau form upload masih ada, siapa pun bisa menandai
 *      order sebagai "sudah bayar" — jalur pencairan uang yang tidak tercatat.
 *   2. TIDAK ADA polling yang mengubah status. Halaman hanya MEMBACA
 *      GET /orders/:id. Menulis status dari browser = memalsukan pembayaran.
 *   3. TIDAK ADA redirect callback ?status=... . Query string bukan bukti.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { CreditCard, CheckCircle, Clock, DollarSign, Timer, ExternalLink, Wallet, AlertCircle } from 'lucide-react';

const formatRupiah = (amount: number) =>
  'Rp ' + Number(amount || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Bentuk dari GET /orders/:id — cerminan decorateOrder() di backend.
interface OrderView {
  order: {
    id: string;
    total: number;
    status: 'AWAITING_PAYMENT' | 'PAID' | 'EXPIRED';
    expiresAt: string | null;
  };
  payment: {
    status: string;
    txnId: string | null;
    method: string | null;
    amount: number;
    fee: number | null;
    qrString: string | null;
    vaNumber: string | null;
    paymentUrl: string | null;
  };
  hold: { expiresAt: string | null };
  items?: number;
}

// Bentuk dari GET /orders (myOrders) — Order, bukan Booking.
interface OrderRow {
  id: string;
  total: string | number;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    startTime: string;
    endTime: string;
    priceSnapshot: string | number;
    booking?: { status: string; holdExpiresAt: string | null; settling: boolean };
  }>;
  payments: Array<{ status: string; amount: string | number }>;
}

function countdown(expiresAt: string | null): { text: string; expired: boolean; pct: number } {
  if (!expiresAt) return { text: '—', expired: true, pct: 0 };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { text: 'Kedaluwarsa', expired: true, pct: 0 };
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return {
    text: `${m}m ${String(s).padStart(2, '0')}s`,
    expired: false,
    pct: Math.max(0, Math.min(100, Math.round((diff / (15 * 60000)) * 100))),
  };
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
function fmtDay(iso: string): string {
  // +12 jam agar tanggal tidak melintasi batas hari saat diformat di UTC.
  return new Date(new Date(iso).getTime() + 12 * 3600_000).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
function fmtTime(iso: string): string {
  return iso.substring(11, 16);
}

export default function RenterPaymentsPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [extending, setExtending] = useState(false);
  const extendedFor = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<OrderRow[]>('/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat pesanan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Polling status HANYA selama ada order menunggu pembayaran. Ini baca-saja:
  // GET /orders/:id tidak pernah mengubah state. Konfirmasi tetap datang dari
  // webhook gateway, bukan dari browser ini.
  useEffect(() => {
    if (!orders.some((o) => o.status === 'AWAITING_PAYMENT')) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [orders, load]);

  const openDetail = useCallback(async (id: string) => {
    setActiveId(id);
    setDetailLoading(true);
    try {
      const { data } = await api.get<OrderView>(`/orders/${id}`);
      setDetail(data);
    } catch {
      toast.error('Gagal memuat detail pesanan.');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const extendHold = useCallback(async () => {
    if (!activeId) return;
    setExtending(true);
    try {
      await api.post(`/orders/${activeId}/extend-hold`);
      extendedFor.current.add(activeId);
      toast.success('Waktu pembayaran diperpanjang 5 menit.');
      await openDetail(activeId);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Gagal memperpanjang waktu.');
    } finally {
      setExtending(false);
    }
  }, [activeId, openDetail, load]);

  const slotLabel = (o: OrderRow) => {
    const items = o.items ?? [];
    if (items.length === 0) return 'Pesanan';
    const first = items[0];
    const head = `${fmtDay(first.startTime)} · ${fmtTime(first.startTime)}–${fmtTime(first.endTime)}`;
    // Paket sewa berkala berisi banyak sesi. Tampilkan tanggal pertama DAN
    // terakhir supaya renter tahu persis cakupan yang dibayar; sebelumnya
    // hanya item[0] yang tampil sehingga order 4 sesi terlihat seperti 1.
    if (items.length > 1) {
      const last = items[items.length - 1];
      const span =
        first.startTime.substring(0, 10) === last.startTime.substring(0, 10)
          ? head
          : `${head} → ${fmtDay(last.startTime)}`;
      return `${span} · ${items.length} sesi`;
    }
    return head;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }

  const pending = orders.filter((o) => o.status === 'AWAITING_PAYMENT');
  const settled = orders.filter((o) => o.status !== 'AWAITING_PAYMENT');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" /> Pembayaran
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selesaikan pembayaran sebelum waktu habis. Slot kamu dilepas otomatis setelah itu.
        </p>
      </div>

      {pending.length === 0 && settled.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada pesanan. Pilih ruangan dulu untuk mulai booking.
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground">
            Menunggu pembayaran ({pending.length})
          </h2>
          {pending.map((o) => {
            const c = countdown(o.items?.[0]?.booking?.holdExpiresAt ?? o.expiresAt);
            const st = STATUS_STYLE[o.status] ?? { label: o.status, tone: 'neutral' as const };
            return (
              <Card key={o.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{slotLabel(o)}</span>
                        <Badge variant={st.tone}>{st.label}</Badge>
                        {o.items?.[0]?.booking?.settling && (
                          <Badge variant="warning">Memverifikasi pembayaran</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          {formatRupiah(Number(o.total))}
                        </span>
                        {o.items && o.items.length > 1 && <span>{o.items.length} sesi</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`text-sm font-mono ${c.expired ? 'text-destructive' : ''}`}>
                          <Timer className="h-3.5 w-3.5 inline mr-1" />
                          {c.text}
                        </div>
                        <div className="h-1 w-28 bg-muted rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full ${c.expired ? 'bg-destructive' : 'bg-primary'}`}
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                      </div>
                      <Button onClick={() => void openDetail(o.id)}>Bayar</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {settled.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground">Riwayat</h2>
          {settled.map((o) => {
            const st = STATUS_STYLE[o.status] ?? { label: o.status, tone: 'neutral' as const };
            return (
              <Card key={o.id}>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{slotLabel(o)}</span>
                      <Badge variant={st.tone}>{st.label}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatRupiah(Number(o.total))}</span>
                  </div>
                  {o.status === 'PAID' && (
                    <Button variant="secondary" size="sm" onClick={() => void openDetail(o.id)}>
                      Lihat detail
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveId(null);
          }}
        >
          {/* Overlay ini tutup HANYA kalau klik jatuh tepat di overlay.
              Memakai e.target === e.currentTarget, bukan stopPropagation,
              supaya tidak perlu(event: any) => void pada elemen di dalamnya. */}
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" /> Detail pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {detailLoading || !detail ? (
                <p className="text-sm text-muted-foreground">Memuat…</p>
              ) : (
                <>
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold">{formatRupiah(detail.order.total)}</span>
                    </div>
                    {detail.payment.fee != null && Number(detail.payment.fee) > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Biaya gateway</span>
                        <span>{formatRupiah(Number(detail.payment.fee))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={STATUS_STYLE[detail.order.status]?.tone ?? 'default'}>
                        {STATUS_STYLE[detail.order.status]?.label ?? detail.order.status}
                      </Badge>
                    </div>
                  </div>

                  {detail.order.status === 'PAID' && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      Pembayaran diterima. Ruangan sudah dipesan untuk kamu.
                    </div>
                  )}

                  {detail.order.status === 'EXPIRED' && (
                    <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      Pesanan ini kedaluwarsa dan slotnya sudah dilepas.
                    </div>
                  )}

                  {detail.order.status === 'AWAITING_PAYMENT' && (
                    <div className="space-y-3">
                      {detail.payment.vaNumber && (
                        <div className="rounded-lg border p-4 text-center space-y-1">
                          <p className="text-xs text-muted-foreground">Nomor Virtual Account</p>
                          <p className="text-2xl font-mono font-bold tracking-wider">
                            {detail.payment.vaNumber}
                          </p>
                        </div>
                      )}
                      {detail.payment.qrString && (
                        <div className="rounded-lg border p-4 text-center space-y-2">
                          <p className="text-xs text-muted-foreground">QRIS</p>
                          {/* qr_string dari gateway berupa string QR, bukan gambar.
                              Ditampilkan apa adanya supaya bisa discan aplikasi pembayaran. */}
                          <p className="text-xs font-mono break-all bg-muted p-2 rounded max-h-24 overflow-auto">
                            {detail.payment.qrString}
                          </p>
                        </div>
                      )}
                      {detail.payment.paymentUrl && (
                        <Button
                          className="w-full"
                          onClick={() => window.open(detail.payment.paymentUrl!, '_blank')}
                        >
                          Buka halaman pembayaran <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                      {!detail.payment.vaNumber &&
                        !detail.payment.qrString &&
                        !detail.payment.paymentUrl && (
                          <p className="text-sm text-muted-foreground">
                            Metode pembayaran sedang disiapkan. Muat ulang halaman beberapa saat lagi.
                          </p>
                        )}
                      {!extendedFor.current.has(activeId) && (
                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={extendHold}
                          disabled={extending}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          {extending ? 'Memproses…' : 'Perpanjang 5 menit'}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}