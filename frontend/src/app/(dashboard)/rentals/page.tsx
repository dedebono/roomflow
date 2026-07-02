'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import api from '@/lib/api';
import { Room, BookingHold, RentalSlot, Building, Payment } from '@/types';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, DoorOpen, Settings } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

interface RentalHold extends BookingHold {
  user?: any;
  room?: Room;
  payments?: Payment[];
}

export default function RentalsDashboardPage() {
  const [holds, setHolds] = useState<RentalHold[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [rentalSlots, setRentalSlots] = useState<RentalSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterRoom, setFilterRoom] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const [selectedHold, setSelectedHold] = useState<RentalHold | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [selectedRoomForSlots, setSelectedRoomForSlots] = useState<Room | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchHolds = useCallback(async () => {
    try {
      const res = await api.get('/rentals/holds');
      setHolds(res.data);
    } catch {
      toast.error('Failed to load booking holds');
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get('/rooms');
      setRooms(res.data);
    } catch { /* silent */ }
  }, []);

  const fetchRentalSlots = useCallback(async () => {
    try {
      const res = await api.get('/rentals/slots');
      setRentalSlots(res.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchHolds(), fetchRooms(), fetchRentalSlots()]);
      setIsLoading(false);
    };
    load();
  }, [fetchHolds, fetchRooms, fetchRentalSlots]);

  const handleApprove = async (hold: RentalHold) => {
    const paymentId = (hold.payments as any)?.[0]?.id;
    if (!paymentId) return;
    setActionLoading(hold.id);
    try {
      await api.patch(`/payments/${paymentId}/approve`);
      toast.success('Payment approved! Booking confirmed.');
      await fetchHolds();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (hold: RentalHold) => {
    const paymentId = (hold.payments as any)?.[0]?.id;
    if (!paymentId) return;
    setActionLoading(hold.id);
    try {
      await api.patch(`/payments/${paymentId}/reject`);
      toast.success('Payment rejected.');
      await fetchHolds();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredHolds = holds.filter((hold) => {
    if (filterRoom && hold.roomId !== filterRoom) return false;
    if (filterStatus && hold.status !== filterStatus) return false;
    if (filterDate) {
      const holdDate = new Date(hold.holdDate).toISOString().split('T')[0];
      if (holdDate !== filterDate) return false;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="warning">Awaiting Payment</Badge>;
      case 'CONVERTED':
        return <Badge variant="success">Confirmed</Badge>;
      case 'EXPIRED':
        return <Badge variant="danger">Expired</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const columns = [
    {
      header: 'Room',
      accessor: (h: RentalHold) => h.room?.name || 'N/A',
    },
    {
      header: 'Renter',
      accessor: (h: RentalHold) => h.user?.name || 'N/A',
    },
    {
      header: 'Date',
      cell: (h: RentalHold) => {
        const parsedDate = new Date(h.holdDate as string);
        const d: Date = !isNaN(parsedDate.getTime()) ? parsedDate : new Date(h.holdDate as string);
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
      },
    },
    {
      header: 'Time',
      cell: (h: RentalHold) => {
        const fmt = (dt: any) => {
          const d = Object.prototype.toString.call(dt) === '[object Date]' ? dt : new Date(dt);
          return isNaN(d.getTime()) ? 'N/A' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };
        return `${fmt(h.startTime as any)} - ${fmt(h.endTime as any)}`;
      },
    },
    {
      header: 'Price',
      cell: (h: RentalHold) => h.payments?.[0] ? `Rp ${h.payments[0].amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-',
    },
    {
      header: 'Status',
      cell: (h: RentalHold) => {
        const p = h.payments?.[0] as any;
        if (!p) return <Badge variant="neutral">—</Badge>;
        switch (p.status) {
          case 'PAYMENT_PROOF_UPLOADED':
            return <Badge variant="info">Proof Uploaded</Badge>;
          case 'PENDING':
            return <Badge variant="warning">Awaiting Payment</Badge>;
          case 'APPROVED':
            return <Badge variant="success">Confirmed</Badge>;
          case 'REJECTED':
            return <Badge variant="danger">Rejected</Badge>;
          default:
            return <Badge variant="neutral">{p.status}</Badge>;
        }
      },
    },
    {
      header: 'Payment',
      cell: (h: RentalHold) => {
        const p = h.payments?.[0] as any;
        if (!p) return <Badge variant="neutral">No Receipt</Badge>;
        return (
          <div className="flex items-center gap-2">
            <Badge variant="info">Uploaded</Badge>
            {p.fileUrl && (
              <button
                onClick={() => window.open(p.fileUrl, '_blank')}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                View
              </button>
            )}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      cell: (h: RentalHold) => (
        <div className="flex gap-2">
          {h.status === 'ACTIVE' && (h.payments as any)?.[0]?.status === 'PAYMENT_PROOF_UPLOADED' && (
            <>
              <Button
                size="sm"
                variant="success"
                onClick={() => handleApprove(h)}
                isLoading={actionLoading === h.id}
              >
                <CheckCircle className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleReject(h)}
                isLoading={actionLoading === h.id}
              >
                <XCircle className="w-3 h-3" />
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSelectedHold(h);
              setDetailModalOpen(true);
            }}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <DashboardLayout title="Rental Management">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <DoorOpen className="w-6 h-6 text-indigo-400" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Rental Management</h1>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setSelectedRoomForSlots(rooms.find((r) => r.isRentable) || null);
            setSlotModalOpen(true);
          }}
          className="text-xs sm:text-sm"
        >
          <Settings className="w-4 h-4" />
          <span>Manage Slots</span>
        </Button>
      </div>

      {/* Filters */}
      <Card className="border border-slate-900 glass">
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Room</label>
              <Select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                options={[
                  { value: '', label: 'All Rooms' },
                  ...rooms.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Date</label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Status</label>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'ACTIVE', label: 'Awaiting Payment' },
                  { value: 'CONVERTED', label: 'Confirmed' },
                  { value: 'EXPIRED', label: 'Expired' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border border-slate-900 glass">
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredHolds}
            emptyMessage="No booking holds found."
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Booking Hold Details"
      >
        {selectedHold && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Room</p>
                <p className="text-slate-800 font-medium">{selectedHold.room?.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Renter</p>
                <p className="text-slate-800 font-medium">{selectedHold.user?.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Date</p>
                <p className="text-slate-800 font-medium">
                  {(() => {
                    const parsedD = new Date(selectedHold.holdDate as string);
                    const d: Date = !isNaN(parsedD.getTime()) ? parsedD : new Date(selectedHold.holdDate as string);
                    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Time</p>
                <p className="text-slate-800 font-medium">
                  {(() => {
                    const fmt = (dt: any) => {
                      const d = dt instanceof Date ? dt : new Date(dt);
                      return isNaN(d.getTime()) ? 'N/A' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    };
                    return `${fmt(selectedHold.startTime)} - ${fmt(selectedHold.endTime)}`;
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Price</p>
                <p className="text-slate-800 font-medium">
                  {selectedHold.payments?.[0]
                    ? `Rp ${selectedHold.payments[0].amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="text-slate-800 font-medium">
                  {(() => {
                    const p = selectedHold.payments?.[0] as any;
                    if (!p) return <Badge variant="neutral">—</Badge>;
                    switch (p.status) {
                      case 'PAYMENT_PROOF_UPLOADED': return <Badge variant="info">Proof Uploaded</Badge>;
                      case 'PENDING': return <Badge variant="warning">Awaiting Payment</Badge>;
                      case 'APPROVED': return <Badge variant="success">Confirmed</Badge>;
                      case 'REJECTED': return <Badge variant="danger">Rejected</Badge>;
                      default: return <Badge variant="neutral">{p.status}</Badge>;
                    }
                  })()}
                </p>
              </div>
            </div>
            {selectedHold.payments?.[0]?.fileUrl && (
              <div>
                <p className="text-xs text-slate-500">Payment Proof</p>
                <button
                  onClick={() => window.open((selectedHold.payments as any)?.[0]?.fileUrl, '_blank')}
                  className="text-indigo-400 hover:text-indigo-300 underline text-sm"
                >
                  View Payment Proof
                </button>
              </div>
            )}
            {(selectedHold as any).status === 'ACTIVE' && ((selectedHold.payments as any)?.[0]?.status as string) === 'PAYMENT_PROOF_UPLOADED' && (
              <div className="flex gap-2 pt-4 border-t border-slate-200">
                <Button
                  variant="success"
                  onClick={() => {
                    handleApprove(selectedHold);
                    setDetailModalOpen(false);
                  }}
                  isLoading={actionLoading === selectedHold.id}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve Payment
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    handleReject(selectedHold);
                    setDetailModalOpen(false);
                  }}
                  isLoading={actionLoading === selectedHold.id}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Payment
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Rental Slots Modal */}
      <Modal
        isOpen={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        title="Manage Rental Time Slots"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Select Room</label>
            <Select
              value={selectedRoomForSlots?.id || ''}
              onChange={(e) => {
                const room = rooms.find((r) => r.id === e.target.value);
                setSelectedRoomForSlots(room || null);
              }}
              options={rooms.filter((r) => r.isRentable).map((r) => ({
                value: r.id,
                label: r.name,
              }))}
            />
          </div>
          {selectedRoomForSlots && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Rental slots for {selectedRoomForSlots.name}:</p>
              {rentalSlots
                .filter((s) => s.roomId === selectedRoomForSlots.id)
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                .map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between p-3 bg-slate-100/50 rounded-lg">
                    <div>
                      <p className="text-slate-800 font-medium">
                        {dayNames[slot.dayOfWeek]} &middot; {slot.startTime} - {slot.endTime}
                      </p>
                      <p className="text-sm text-slate-500">Rp {slot.price.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} / hour</p>
                    </div>
                    <Badge variant={slot.isActive !== false ? 'success' : 'neutral'}>
                      {slot.isActive !== false ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              {rentalSlots.filter((s) => s.roomId === selectedRoomForSlots.id).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No rental slots configured for this room.</p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
    </DashboardLayout>
  );
}
