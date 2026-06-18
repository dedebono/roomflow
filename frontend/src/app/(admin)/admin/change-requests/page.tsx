'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import api from '@/lib/api';
import { BookingChangeRequest, Room } from '@/types';
import toast from 'react-hot-toast';
import { BellRing, Check, X } from 'lucide-react';

export default function AdminChangeRequestsPage() {
  const [requests, setRequests] = useState<BookingChangeRequest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingId, setIsSubmittingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/booking-change-requests');
      setRequests(res.data);

      const roomsRes = await api.get('/rooms');
      setRooms(roomsRes.data);
    } catch (err: any) {
      toast.error('Failed to load pending change requests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Request Approval
  const handleApprove = async (id: string) => {
    setIsSubmittingId(id);
    try {
      await api.patch(`/booking-change-requests/${id}/approve`);
      toast.success('Reschedule request successfully approved!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Approval failed due to conflict');
    } finally {
      setIsSubmittingId(null);
    }
  };

  // Handle Request Rejection
  const handleReject = async (id: string) => {
    setIsSubmittingId(id);
    try {
      await api.patch(`/booking-change-requests/${id}/reject`);
      toast.success('Reschedule request successfully rejected');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setIsSubmittingId(null);
    }
  };

  const displayDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const pastRequests = requests.filter((r) => r.status !== 'PENDING');

  const pendingColumns = [
    {
      header: 'Filed By',
      cell: (r: BookingChangeRequest) => (
        <div>
          <p className="font-bold text-slate-900">{r.requestedBy?.name || 'User'}</p>
          <p className="text-xs text-slate-500">{r.requestedBy?.email}</p>
        </div>
      ),
    },
    {
      header: 'Current Schedule',
      cell: (r: BookingChangeRequest) => (
        <div className="flex flex-col gap-0.5 text-xs text-slate-500">
          <p className="font-bold text-slate-600 truncate max-w-[150px]">{r.booking?.title}</p>
          <p>🚪 Room: <span className="font-semibold text-slate-500">{r.booking?.room?.name}</span></p>
          <p>⏰ Time: <span>{displayDateTime(r.booking?.startTime || '')} - {displayDateTime(r.booking?.endTime || '')}</span></p>
        </div>
      ),
    },
    {
      header: 'Proposed Modifications',
      cell: (r: BookingChangeRequest) => {
        const roomName = rooms.find((rm) => rm.id === r.requestedRoomId)?.name || r.booking?.room?.name;
        return (
          <div className="flex flex-col gap-0.5 text-xs text-slate-800 bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2.5 max-w-[260px]">
            <p>
              🚪 Room: <span className="font-bold text-indigo-400">{roomName}</span>
            </p>
            <p>
              ⏰ Start: <span className="font-semibold text-indigo-400">{displayDateTime(r.requestedStart || '')}</span>
            </p>
            <p>
              ⏰ End: <span className="font-semibold text-indigo-400">{displayDateTime(r.requestedEnd || '')}</span>
            </p>
            {r.reason && <p className="italic text-slate-500 border-t border-slate-200/40 pt-1 mt-1">&ldquo;{r.reason}&rdquo;</p>}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (r: BookingChangeRequest) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="success"
            onClick={() => handleApprove(r.id)}
            isLoading={isSubmittingId === r.id}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve</span>
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleReject(r.id)}
            isLoading={isSubmittingId === r.id}
          >
            <X className="w-3.5 h-3.5" />
            <span>Reject</span>
          </Button>
        </div>
      ),
    },
  ];

  const pastColumns = [
    {
      header: 'Employee Name',
      cell: (r: BookingChangeRequest) => (
        <span className="font-bold text-slate-900">{r.requestedBy?.name || 'User'}</span>
      ),
    },
    {
      header: 'Original Event',
      cell: (r: BookingChangeRequest) => (
        <span className="text-slate-500 font-semibold">{r.booking?.title}</span>
      ),
    },
    {
      header: 'Action Time',
      cell: (r: BookingChangeRequest) => (
        <span className="text-xs text-slate-500">{new Date(r.updatedAt).toLocaleDateString()}</span>
      ),
    },
    {
      header: 'Final State',
      cell: (r: BookingChangeRequest) => {
        const variants = {
          PENDING: 'warning' as const,
          APPROVED: 'success' as const,
          REJECTED: 'danger' as const,
        };
        return <Badge variant={variants[r.status]}>{r.status}</Badge>;
      },
    },
  ];

  return (
    <DashboardLayout title="Change Requests Approval Portal" description="Review scheduling conflicts and authorize or deny employee change proposals." allowedRoles={['ROOM_ADMIN']}>
      {/* Pending Requests */}
      <Card className="border border-slate-900 glass">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-indigo-400" />
            <span>Pending Approvals</span>
          </CardTitle>
          <CardDescription>Reschedule proposals requiring manager authorization</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={pendingColumns}
            data={pendingRequests}
            emptyMessage="Excellent! You have processed all pending reschedule requests."
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Processed Requests */}
      <Card className="border border-slate-900 glass">
        <CardHeader className="p-0 mb-4">
          <CardTitle>Approval Log History</CardTitle>
          <CardDescription>Archive of historically approved and rejected rescheduling proposals</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={pastColumns}
            data={pastRequests}
            emptyMessage="No historical change request records exist."
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
