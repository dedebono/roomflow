'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import api, { paymentGatewaysApi } from '@/lib/api';
import { BookingHold, Payment } from '@/types';
import type { PaymentGatewayPublic } from '@/types/payment-gateway';
import toast from 'react-hot-toast';
import { Upload, CreditCard, CheckCircle, Clock, XCircle, FileText, Calendar, DollarSign, Timer, ExternalLink, Wallet } from 'lucide-react';

const formatRupiah = (amount: number) =>
  'Rp ' + amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Shape returned by /rentals/my-holds
interface PendingHold {
  id: string;
  roomId: string;
  holdDate: string;
  startTime: string;
  endTime: string;
  expiresAt: string;
  status: string;
  room: { name: string };
  payments: { id: string; status: string; amount: number; createdAt: string }[];
}

interface PendingPayment {
  id: string;
  bookingHoldId: string;
  bookingHold: BookingHold;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

function getCountdown(expiresAt: string): string {
  const now = new Date().getTime();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function getCountdownPercent(expiresAt: string): number {
  const now = new Date().getTime();
  const expires = new Date(expiresAt).getTime();
  const total = 60 * 60 * 1000; // 1 hour
  const remaining = Math.max(0, expires - now);
  return Math.round((remaining / total) * 100);
}

export default function RenterPaymentsPage() {
  console.log('PAYMENTS_PAGE_MOUNTED');
  const [pendingHolds, setPendingHolds] = useState<PendingHold[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedHoldId, setSelectedHoldId] = useState<string>('');
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [gateways, setGateways] = useState<PaymentGatewayPublic[]>([]);
  const [selectedGatewayId, setSelectedGatewayId] = useState<string>('');
  const [selectedGatewayName, setSelectedGatewayName] = useState<string>('');
  const [isInitiatingGateway, setIsInitiatingGateway] = useState(false);
  // countdownMap: holdId → "Mm Ss" string
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0); // force re-render every second

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const holdsRes = await api.get('/rentals/my-holds', { timeout: 20000 });
      const holds: PendingHold[] = holdsRes.data;

      // Seed initial countdowns
      const initial: Record<string, string> = {};
      holds.forEach((h) => {
        if (h.expiresAt) {
          initial[h.id] = getCountdown(h.expiresAt);
        }
      });
      setCountdowns(initial);
      setPendingHolds(holds);

      const paymentsRes = await api.get('/payments/my', { timeout: 20000 });
      setAllPayments(paymentsRes.data);
    } catch {
      toast.error('Failed to load payment data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Handle Pakasir redirect (payment completed via QR/redirect)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const orderStatus = params.get('status');
    const orderId = params.get('order_id');
    if (orderStatus && orderId) {
      // Clear URL params without reload
      window.history.replaceState({}, '', window.location.pathname);
      if (orderStatus === 'success' || orderStatus === 'completed') {
        toast.success('Payment completed! Confirming with server...');
        // Call backend to process redirect callback (acts like webhook for redirect-based flows)
        // Use fetch with timeout to avoid hanging forever if backend is slow
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/payments/confirm-callback?order_id=${encodeURIComponent(orderId)}&status=${encodeURIComponent(orderStatus)}`, {
          signal: controller.signal,
        })
          .then(() => {
            clearTimeout(timeoutId);
            toast.success('Payment confirmed!');
            fetchPayments();
          })
          .catch(() => {
            clearTimeout(timeoutId);
            // Fallback: just refresh the payment list
            fetchPayments();
          });
      } else if (orderStatus === 'failed') {
        toast.error('Payment failed. Please try again.');
        fetchPayments();
      }
    }
  }, [fetchPayments]);

  // Tick every second to update countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setPendingHolds((prev) => {
        const updated: Record<string, string> = {};
        let changed = false;
        prev.forEach((h) => {
          if (h.expiresAt) {
            const cd = getCountdown(h.expiresAt);
            updated[h.id] = cd;
            if (cd !== countdowns[h.id]) changed = true;
          }
        });
        if (changed) setCountdowns(updated);
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdowns]);

  const handleOpenUpload = async (holdId: string) => {
    setSelectedHoldId(holdId);
    const hold = pendingHolds.find((h) => h.id === holdId);
    setSelectedAmount(hold?.payments?.[0]?.amount ?? 0);
    setPaymentFile(null);
    setSelectedGatewayId('');
    setSelectedGatewayName('');
    setIsUploadModalOpen(true);

    // Load available gateways
    try {
      const data = await paymentGatewaysApi.getAvailable();
      setGateways(data);
      if (data.length > 0) {
        setSelectedGatewayId(data[0].id);
        setSelectedGatewayName(data[0].name);
      }
    } catch {
      setGateways([]);
    }
  };

  const handlePaymentUpload = async () => {
    if (!paymentFile || !selectedHoldId) {
      toast.error('Please select a payment file');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('paymentData', JSON.stringify({ bookingHoldId: selectedHoldId, amount: selectedAmount }));
      formData.append('file', paymentFile);

      await api.post('/payments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Payment proof uploaded successfully!');
      setIsUploadModalOpen(false);
      setPaymentFile(null);
      setSelectedHoldId('');
      fetchPayments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload payment proof');
    } finally {
      setIsUploading(false);
    }
  };

  const handleInitiateGatewayPayment = async () => {
    if (!selectedGatewayId || !selectedHoldId || !selectedAmount) {
      toast.error('Please select a payment gateway and ensure an amount is set.');
      return;
    }

    setIsInitiatingGateway(true);
    try {
      const res = await api.post('/payments/initiate', {
        bookingHoldId: selectedHoldId,
        gatewayId: selectedGatewayId,
        amount: selectedAmount,
        paymentMethod: 'qris',
      });

      const { paymentUrl } = res.data;
      if (paymentUrl) {
        toast.success('Redirecting to payment gateway...');
        setTimeout(() => {
          window.location.href = paymentUrl;
        }, 1000);
      } else {
        toast.success(`Payment initiated via ${selectedGatewayName}. Please complete payment on the gateway.`);
        setIsUploadModalOpen(false);
        fetchPayments();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to initiate payment');
    } finally {
      setIsInitiatingGateway(false);
    }
  };

  const handleCloseModal = () => {
    setIsUploadModalOpen(false);
    setSelectedGatewayId('');
    setSelectedGatewayName('');
    setGateways([]);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>;
      case 'PAYMENT_PROOF_UPLOADED':
        return <Badge variant="info">Waiting</Badge>;
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Pending Payments Section */}
      <Card className="border border-slate-900 glass">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Pending Payments
          </CardTitle>
          <CardDescription>
            Complete your payment by uploading proof of transfer — your slot is held for 1 hour
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : pendingHolds.filter(h => {
            const latestPayment = h.payments?.[0];
            return !latestPayment || latestPayment.status === 'PENDING';
          }).length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500/50" />
              <p>No pending payments. You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingHolds.filter(h => {
                const latestPayment = h.payments?.[0];
                return !latestPayment || latestPayment.status === 'PENDING';
              }).map((hold) => {
                const countdown = countdowns[hold.id] ?? '';
                const pct = getCountdownPercent(hold.expiresAt ?? new Date().toISOString());
                const isExpired = countdown === 'Expired';
                const latestPayment = (hold.payments?.[0] as any) || null;
                const paymentStatus = latestPayment?.status ?? 'PENDING';
                const amount = latestPayment?.amount ?? 0;

                return (
                  <div
                    key={hold.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isExpired
                        ? 'border-slate-300/50 bg-slate-100/20'
                        : 'border-amber-500/20 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                        isExpired ? 'bg-slate-100' : 'bg-amber-500/20'
                      }`}>
                        {isExpired ? (
                          <XCircle className="w-6 h-6 text-slate-500" />
                        ) : (
                          <DollarSign className="w-6 h-6 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">
                          {hold.room?.name || 'Room'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {hold.holdDate && formatDate(hold.holdDate)} at {formatTime(hold.startTime)} - {formatTime(hold.endTime)}
                        </p>
                        {amount > 0 && (
                          <p className="text-lg font-bold text-amber-400 mt-1">
                            {formatRupiah(amount)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {/* Countdown timer */}
                      {!isExpired && hold.expiresAt && (
                        <div className="w-full sm:w-48">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-amber-400 font-semibold flex items-center gap-1">
                              <Timer className="w-3 h-3" />
                              Time remaining
                            </span>
                            <span className="text-amber-300 font-mono font-bold">{countdown}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-1000"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {isExpired && (
                        <Badge variant="neutral">Hold Expired</Badge>
                      )}

                      <div className="flex items-center gap-2">
                        {getStatusBadge(paymentStatus)}
                        {!isExpired && paymentStatus !== 'APPROVED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenUpload(hold.id)}
                          >
                            <Upload className="w-4 h-4" />
                            Upload Proof
                          </Button>
                        )}
                        {latestPayment && paymentStatus !== 'PENDING' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => window.open(latestPayment.fileUrl, '_blank')}
                          >
                            <FileText className="w-4 h-4" />
                            View Proof
                          </Button>
                        )}
                      </div>
                      </div>
                      </div>
                      );
                      })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History Section */}
      <Card className="border border-slate-900 glass">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Payment History
          </CardTitle>
          <CardDescription>Track all your past payments and their status</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : allPayments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p>No payment history yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/20">
              {allPayments.map((payment) => {
                try {
                  return (
                    <div
                      key={payment.id}
                      className="p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          payment.status === 'APPROVED' ? 'bg-emerald-500/20' :
                          payment.status === 'REJECTED' ? 'bg-rose-500/20' :
                          'bg-slate-100'
                        }`}>
                          {payment.status === 'APPROVED' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          ) : payment.status === 'REJECTED' ? (
                            <XCircle className="w-5 h-5 text-rose-400" />
                          ) : (
                            <Clock className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {(payment as any).booking?.room?.name || (payment as any).booking?.title || 'Room Rental'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate((payment as any).booking?.startTime)} at {formatTime((payment as any).booking?.startTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-slate-900">{formatRupiah((payment as any).amount)}</span>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(payment.status)}
                          {(payment as any).fileUrl && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => window.open((payment as any).fileUrl, '_blank')}
                            >
                              <FileText className="w-4 h-4" />
                              View Proof
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                } catch (e) {
                  console.error('Payment render error:', e, payment);
                  return null;
                }
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Payment Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={handleCloseModal}
        title="Complete Payment"
        size="md"
      >
        {/* Gateway Selection */}
        {gateways.length > 0 && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2 block">
              <Wallet className="w-3.5 h-3.5 inline mr-1" />
              Select Payment Gateway
            </label>
            <div className="grid grid-cols-1 gap-2">
              {gateways.map((gw) => (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => { setSelectedGatewayId(gw.id); setSelectedGatewayName(gw.name); }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedGatewayId === gw.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-500/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      selectedGatewayId === gw.id ? 'bg-indigo-500/20' : 'bg-slate-100'
                    }`}>
                      {gw.logo ? (
                        <img src={gw.logo} alt={gw.name} className="h-5 w-5 rounded object-contain" />
                      ) : (
                        <Wallet className={`w-4 h-4 ${selectedGatewayId === gw.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${selectedGatewayId === gw.id ? 'text-indigo-600' : 'text-slate-800'}`}>
                        {gw.name}
                      </p>
                      <p className="text-xs text-slate-500">Pay directly via {gw.name}</p>
                    </div>
                    {selectedGatewayId === gw.id && (
                      <CheckCircle className="w-4 h-4 text-indigo-500 ml-auto" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <Button
              variant="primary"
              className="w-full mt-3"
              isLoading={isInitiatingGateway}
              onClick={handleInitiateGatewayPayment}
            >
              <ExternalLink className="w-4 h-4" />
              Pay with {selectedGatewayName || 'Gateway'}
            </Button>

            {selectedGatewayName?.toLowerCase() !== 'pakasir' ? (
              <div className="space-y-4">
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs text-slate-400">or upload proof manually</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5">
                  <p className="text-xs text-indigo-300">
                    <strong>Manual Transfer Instructions:</strong><br />
                    Bank: Demo Bank<br />
                    Account: 1234-5678-9012<br />
                    Name: RoomFlow Rentals
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                    Payment Receipt / Screenshot
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/20 file:text-indigo-300 hover:file:bg-indigo-500/30 cursor-pointer"
                  />
                </div>

                {paymentFile && (
                  <div className="p-3 rounded-lg bg-slate-100/50 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    <div>
                      <p className="text-sm text-slate-600">{paymentFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(paymentFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/40">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsUploadModalOpen(false)}
                  >
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
            ) : null}
        </div>
        )}
        </Modal>
      </>
    );
  }