'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/api';
import { BookingHold, Payment } from '@/types';
import toast from 'react-hot-toast';
import { Upload, CreditCard, CheckCircle, Clock, XCircle, FileText, Calendar, DollarSign, Timer } from 'lucide-react';

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
  const [pendingHolds, setPendingHolds] = useState<PendingHold[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedHoldId, setSelectedHoldId] = useState<string>('');
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // countdownMap: holdId → "Mm Ss" string
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0); // force re-render every second

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const holdsRes = await api.get('/rentals/my-holds');
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

      const paymentsRes = await api.get('/payments/my');
      setAllPayments(paymentsRes.data);
    } catch {
      toast.error('Failed to load payment data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
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

  const handleOpenUpload = (holdId: string) => {
    setSelectedHoldId(holdId);
    const hold = pendingHolds.find((h) => h.id === holdId);
    setSelectedAmount(hold?.payments?.[0]?.amount ?? 0);
    setPaymentFile(null);
    setIsUploadModalOpen(true);
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
          ) : pendingHolds.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500/50" />
              <p>No pending payments. You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingHolds.map((hold) => {
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
                        ? 'border-slate-700/50 bg-slate-800/20'
                        : 'border-amber-500/20 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                        isExpired ? 'bg-slate-800' : 'bg-amber-500/20'
                      }`}>
                        {isExpired ? (
                          <XCircle className="w-6 h-6 text-slate-500" />
                        ) : (
                          <DollarSign className="w-6 h-6 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-100">
                          {hold.room?.name || 'Room'}
                        </p>
                        <p className="text-sm text-slate-400">
                          {hold.holdDate && formatDate(hold.holdDate)} at {formatTime(hold.startTime)} - {formatTime(hold.endTime)}
                        </p>
                        {amount > 0 && (
                          <p className="text-lg font-bold text-amber-400 mt-1">
                            ${amount}
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
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
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
              {allPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      payment.status === 'APPROVED' ? 'bg-emerald-500/20' :
                      payment.status === 'REJECTED' ? 'bg-rose-500/20' :
                      'bg-slate-800'
                    }`}>
                      {payment.status === 'APPROVED' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : payment.status === 'REJECTED' ? (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">
                        {(payment as any).booking?.room?.name || (payment as any).booking?.title || 'Room Rental'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate((payment as any).booking?.startTime)} at {formatTime((payment as any).booking?.startTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-100">${payment.amount}</span>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Payment Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Payment Proof"
        size="md"
      >
        <div className="space-y-4">
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
            <div className="p-3 rounded-lg bg-slate-800/50 flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-400" />
              <div>
                <p className="text-sm text-slate-300">{paymentFile.name}</p>
                <p className="text-xs text-slate-500">
                  {(paymentFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/40">
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
      </Modal>
    </>
  );
}
