'use client';

/**
 * Keranjang + Checkout.
 *
 * Ini tempat slot BENAR-BENAR dikunci untuk renter. Klik "Checkout" ->
 * POST /checkout dengan Idempotency-Key -> backend mengunci semua item dalam
 * SATU transaksi (all-or-nothing), membuat Order, lalu memanggil gateway.
 *
 * Idempotency-Key dibuat sekali per attempt lalu disimpan di ref. Kalau user
 * menekan tombol dua kali, atau koneksi putus lalu dia coba lagi, backend
 * mengembalikan Order yang SAMA dan tidak memanggil gateway dua kali.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import toast from 'react-hot-toast';
import { ShoppingCart, Trash2, ArrowLeft, Loader2, AlertCircle, Lock } from 'lucide-react';

interface CartItem {
  id: string;
  roomId: string;
  startTime: string;
  endTime: string;
  priceSnapshot: string | number;
  /**
   * Nama ruangan. Backend lama TIDAK mengirim field ini, jadi halaman ini
   * selalu tampil "Ruangan" — tidak kelihatan saat keranjang cuma berisi
   * satu ruangan, tapi langsung jelas begitu sewa banyak ruangan aktif.
   */
  roomName?: string | null;
  room?: { id: string; name: string } | null;
}

interface CheckoutResponse {
  order: { id: string; total: number; status: string; expiresAt: string | null };
  payment: { txnId: string | null; paymentUrl: string | null; qrString: string | null; vaNumber: string | null };
  hold: { expiresAt: string | null };
  items: number;
}

// Booking disimpan nominal-UTC: HH:MM pada ISO adalah jam yang diklik
// user. `new Date(iso).toLocaleTimeString()` mengonversi ke zona browser dan
// menggesernya (09:00 tampil jadi 17:00 di WIB) — renter akan datang pada
// jam yang salah. Baca substring-nya langsung, jangan lewat Date.
const hhmm = (iso: string) => iso.substring(11, 16);
const fmtDay = (iso: string) =>
  new Date(
    new Date(iso).getTime() + 12 * 3600_000, // tengah hari agar tidak melintasi batas hari
  ).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  // Key dibuat sekali dan dipakai ulang untuk semua retry tombol ini. Kalau
  // dibuat ulang tiap klik, backend menganggap tiap klik itu order baru dan
  // renter bisa terkunci dua slot untuk satu niat beli.
  const idemKey = useRef<string>(crypto.randomUUID());

  const load = useCallback(async () => {
    try {
      // interceptor TIDAK unwrap: api.get selalu mengembalikan AxiosResponse.
      const { data } = await api.get<{ items: CartItem[]; total: number }>('/cart');
      setItems(data?.items ?? []);
      setTotal(Number(data?.total ?? 0));
    } catch {
      toast.error('Gagal memuat keranjang.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const removeItem = async (id: string) => {
    try {
      await api.delete(`/cart/items/${id}`);
      await load();
    } catch {
      toast.error('Gagal menghapus item.');
    }
  };

  const clearCart = async () => {
    if (!confirm('Kosongkan keranjang?')) return;
    try {
      await api.delete('/cart');
      await load();
    } catch {
      toast.error('Gagal mengosongkan keranjang.');
    }
  };

  const checkout = async () => {
    if (items.length === 0) return;
    setCheckingOut(true);
    try {
      const { data: res } = await api.post<CheckoutResponse>(
        '/checkout',
        {
          items: items.map((i) => ({
            roomId: i.roomId,
            startTime: i.startTime,
            endTime: i.endTime,
          })),
        },
        { headers: { 'Idempotency-Key': idemKey.current } },
      );
      // Order sudah ada dan slot terkunci — keranjang harus kosong supaya
      // user tidak bisa checkout item yang sama lagi.
      try {
        await api.delete('/cart');
      } catch {
        /* tidak kritis */
      }
      if (res.payment?.paymentUrl) window.open(res.payment.paymentUrl, '_blank');
      router.push('/renter/payments');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Checkout gagal.';
      toast.error(msg);
      if (e?.response?.status === 409) {
        // Slot diambil orang lain — keranjang masih ada, biarkan user pilih lagi.
        await load();
      }
      if (e?.response?.status === 422) {
        toast.error('Periksa kembali slot yang dipilih (jam sewa / durasi).');
      }
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/renter/rooms">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Cari ruangan
          </Button>
        </Link>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCart}>
            <Trash2 className="h-4 w-4 mr-2" /> Kosongkan
          </Button>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" /> Keranjang
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Keranjang belum mengunci slot. Kunci dibuat saat Checkout, berlaku 15 menit.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keranjang kosong.{' '}
            <Link href="/renter/rooms" className="underline">
              Pilih ruangan
            </Link>{' '}
            untuk mulai.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0 divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{item.roomName ?? item.room?.name ?? 'Ruangan'}</p>
                    <p className="text-sm text-muted-foreground">
                      {fmtDay(item.startTime)} · {hhmm(item.startTime)}–{hhmm(item.endTime)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatRupiah(Number(item.priceSnapshot))}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      aria-label="Hapus item"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Hapus</span>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatRupiah(total)}</span>
              </div>
              <Button className="w-full" size="lg" onClick={checkout} disabled={checkingOut}>
                {checkingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses…
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" /> Checkout
                  </>
                )}
              </Button>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Semua slot dikunci sekaligus. Kalau satu sudah diambil, seluruh checkout
                  dibatalkan dan tidak ada slot yang tertahan.
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}