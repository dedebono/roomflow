'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import api from '@/lib/api';
import { Building, Room, RoomStatus } from '@/types';
import toast from 'react-hot-toast';
import { Building2, Plus, Edit2, Trash2, Users, Compass, FileText } from 'lucide-react';

export default function AdminRoomsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Building Modal State
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  const [buildingName, setBuildingName] = useState('');
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);

  // Room Modal State
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomBuildingId, setRoomBuildingId] = useState('');
  const [roomCapacity, setRoomCapacity] = useState<number>(10);
  const [roomDesc, setRoomDesc] = useState('');
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch initial details
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const buildingsRes = await api.get('/buildings');
      setBuildings(buildingsRes.data);

      const roomsRes = await api.get('/rooms');
      setRooms(roomsRes.data);
    } catch (err: any) {
      toast.error('Failed to load room management details');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Building Submit
  const handleBuildingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildingName) return;

    setIsSubmitting(true);
    try {
      if (editingBuildingId) {
        await api.patch(`/buildings/${editingBuildingId}`, { name: buildingName });
        toast.success('Building successfully updated');
      } else {
        await api.post('/buildings', { name: buildingName });
        toast.success('Building successfully created');
      }
      setIsBuildingModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Building Modal
  const handleOpenEditBuilding = (b: Building) => {
    setEditingBuildingId(b.id);
    setBuildingName(b.name);
    setIsBuildingModalOpen(true);
  };

  // Open New Building Modal
  const handleOpenNewBuilding = () => {
    setEditingBuildingId(null);
    setBuildingName('');
    setIsBuildingModalOpen(true);
  };

  // Handle Delete Building
  const handleDeleteBuilding = async (id: string) => {
    if (!confirm('Are you sure you want to delete this building? All rooms within this building will be deleted as well!')) return;

    try {
      await api.delete(`/buildings/${id}`);
      toast.success('Building successfully deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Deletion failed');
    }
  };

  // Handle Room Submit
  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName || !roomBuildingId || !roomCapacity) {
      toast.error('Please fill in all room fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        buildingId: roomBuildingId,
        name: roomName,
        capacity: Number(roomCapacity),
        description: roomDesc || undefined,
        status: roomStatus,
      };

      if (editingRoomId) {
        await api.patch(`/rooms/${editingRoomId}`, payload);
        toast.success('Room successfully updated');
      } else {
        await api.post('/rooms', payload);
        toast.success('Room successfully created');
      }
      setIsRoomModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Room operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Room Modal
  const handleOpenEditRoom = (r: Room) => {
    setEditingRoomId(r.id);
    setRoomName(r.name);
    setRoomBuildingId(r.buildingId);
    setRoomCapacity(r.capacity);
    setRoomDesc(r.description || '');
    setRoomStatus(r.status);
    setIsRoomModalOpen(true);
  };

  // Open New Room Modal
  const handleOpenNewRoom = () => {
    setEditingRoomId(null);
    setRoomName('');
    if (buildings.length > 0) {
      setRoomBuildingId(buildings[0].id);
    } else {
      setRoomBuildingId('');
    }
    setRoomCapacity(10);
    setRoomDesc('');
    setRoomStatus('ACTIVE');
    setIsRoomModalOpen(true);
  };

  // Handle Delete Room
  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;

    try {
      await api.delete(`/rooms/${id}`);
      toast.success('Room successfully deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Room deletion failed');
    }
  };

  // Table structures
  const buildingColumns = [
    {
      header: 'Building Name',
      accessor: 'name' as const,
      cell: (b: Building) => (
        <span className="font-bold text-slate-100 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-400" />
          {b.name}
        </span>
      ),
    },
    {
      header: 'Total Rooms',
      cell: (b: Building) => {
        const count = rooms.filter((r) => r.buildingId === b.id).length;
        return <span className="font-semibold text-slate-300">{count} rooms</span>;
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (b: Building) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEditBuilding(b)}
            className="text-slate-400 hover:text-white hover:bg-slate-800/60 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteBuilding(b.id)}
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const roomColumns = [
    {
      header: 'Room Detail',
      accessor: 'name' as const,
      cell: (r: Room) => (
        <div>
          <p className="font-bold text-slate-100">{r.name}</p>
          {r.description && <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{r.description}</p>}
        </div>
      ),
    },
    {
      header: 'Assigned Building',
      cell: (r: Room) => {
        const b = buildings.find((bl) => bl.id === r.buildingId);
        return <span className="font-semibold text-slate-300">{b?.name || 'Building'}</span>;
      },
    },
    {
      header: 'Seating Capacity',
      cell: (r: Room) => (
        <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Up to {r.capacity} guests
        </span>
      ),
    },
    {
      header: 'Operational State',
      cell: (r: Room) => (
        <Badge variant={r.status === 'ACTIVE' ? 'success' : 'warning'}>
          {r.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (r: Room) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEditRoom(r)}
            className="text-slate-400 hover:text-white hover:bg-slate-800/60 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteRoom(r.id)}
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout title="Rooms & Buildings" description="Manage spatial allocations, add meeting rooms, and toggle operational states." allowedRoles={['ROOM_ADMIN']}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Buildings Table Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              <span>Buildings</span>
            </h2>
            <Button size="sm" variant="secondary" onClick={handleOpenNewBuilding} className="h-8">
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </Button>
          </div>

          <DataTable
            columns={buildingColumns}
            data={buildings}
            emptyMessage="No buildings configured."
            isLoading={isLoading}
          />
        </div>

        {/* Rooms Table Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-400" />
              <span>Meeting Rooms</span>
            </h2>
            <Button size="sm" variant="primary" onClick={handleOpenNewRoom} className="h-8" disabled={buildings.length === 0}>
              <Plus className="w-3.5 h-3.5" />
              <span>Create Room</span>
            </Button>
          </div>

          <DataTable
            columns={roomColumns}
            data={rooms}
            emptyMessage={buildings.length === 0 ? "You must configure a building before creating rooms!" : "No rooms configured."}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Building Dialog Modal */}
      <Modal
        isOpen={isBuildingModalOpen}
        onClose={() => setIsBuildingModalOpen(false)}
        title={editingBuildingId ? 'Edit Building Name' : 'Create New Office Building'}
        size="sm"
      >
        <form onSubmit={handleBuildingSubmit} className="space-y-4">
          <Input
            label="Building Name"
            type="text"
            placeholder="e.g., East Tower"
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            leftIcon={<Building2 className="w-4 h-4" />}
            required
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" onClick={() => setIsBuildingModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingBuildingId ? 'Save Changes' : 'Create Building'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Room Dialog Modal */}
      <Modal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        title={editingRoomId ? 'Modify Workspace Room' : 'Add New Workspace Room'}
        size="md"
      >
        <form onSubmit={handleRoomSubmit} className="space-y-4">
          <Select
            label="Assigned Office Building"
            options={buildings.map((b) => ({ value: b.id, label: b.name }))}
            value={roomBuildingId}
            onChange={(e) => setRoomBuildingId(e.target.value)}
            required
          />

          <Input
            label="Room Name"
            type="text"
            placeholder="e.g., Creative Room 302"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            leftIcon={<Compass className="w-4 h-4" />}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Seating Capacity"
              type="number"
              min={1}
              value={roomCapacity}
              onChange={(e) => setRoomCapacity(Number(e.target.value))}
              leftIcon={<Users className="w-4 h-4" />}
              required
            />
            <Select
              label="Operational Status"
              options={[
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'MAINTENANCE', label: 'MAINTENANCE' },
              ]}
              value={roomStatus}
              onChange={(e) => setRoomStatus(e.target.value as RoomStatus)}
              required
            />
          </div>

          <Input
            label="Room Description / Amenities"
            type="text"
            placeholder="e.g., Projector screen, HDMI connection, Whiteboard"
            value={roomDesc}
            onChange={(e) => setRoomDesc(e.target.value)}
            leftIcon={<FileText className="w-4 h-4" />}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" onClick={() => setIsRoomModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingRoomId ? 'Save Room' : 'Create Room'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
