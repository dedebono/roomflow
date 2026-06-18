'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { FileText, CheckCircle, Clock, XCircle, Eye, DollarSign } from 'lucide-react';

interface ManagerPayment {
  id: string;
  amount: number;
  status: 'PENDING' | 'PAYMENT_PROOF_UPLOADED' | 'APPROVED' | 'REJECTED';
  fileUrl: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  booking: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    room: {
      id: string;
      name: string;
    };
  };
}

export default function ManagerPaymentsPage() {
  const [payments, setPayments] = useState<ManagerPayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<ManagerPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/payments/pending');
      setPayments(res.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredPayments(payments);
    } else {
      setFilteredPayments(payments.filter((p) => p.status === statusFilter));
    }
  }, [payments, statusFilter]);

  const handleApprove = async (paymentId: string) => {
    setApprovingId(paymentId);
    try {
      await api.patch(`/payments/${paymentId}/approve`);
      toast.success('Payment approved');
      fetchPayments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve payment');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (paymentId: string) => {
    setRejectingId(paymentId);
    try {
      await api.patch(`/payments/${paymentId}/reject`);
      toast.success('Payment rejected');
      fetchPayments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject payment');
    } finally {
      setRejectingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>;
      case 'PAYMENT_PROOF_UPLOADED':
        return <Badge variant="info">Proof Uploaded</Badge>;
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

  const statusOptions = [
    { value: 'all', label: 'All Payments' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'PAYMENT_PROOF_UPLOADED', label: 'Proof Uploaded' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-slate-900">Payment Management</h1>
      </div>

      {/* Status Filter */}
      <Card className="border border-slate-900 glass">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Filter by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  statusFilter === option.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <Card className="border border-slate-900 glass">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Payments ({filteredPayments.length})
          </CardTitle>
          <CardDescription>Review and approve rental payment proofs</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500/50" />
              <p>No payments to review</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/20">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
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
                          {payment.booking.room.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {payment.user.name} ({payment.user.email})
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 ml-13">
                      {formatDate(payment.booking.startTime)} at {formatTime(payment.booking.startTime)} - {formatTime(payment.booking.endTime)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-slate-900">${payment.amount}</p>
                      {getStatusBadge(payment.status)}
                    </div>

                    <div className="flex items-center gap-2">
                      {payment.fileUrl && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(payment.fileUrl, '_blank')}
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      )}

                      {payment.status === 'PAYMENT_PROOF_UPLOADED' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleApprove(payment.id)}
                            isLoading={approvingId === payment.id}
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleReject(payment.id)}
                            isLoading={rejectingId === payment.id}
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
