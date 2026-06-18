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
import { Building, Room, RoomStatus, RentalSlot, RoomCategory } from '@/types';
import toast from 'react-hot-toast';
import { Building2, Plus, Edit2, Trash2, Users, Compass, FileText, X, Settings, DollarSign, Clock, ListFilter } from 'lucide-react';

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
  const [roomIsRentable, setRoomIsRentable] = useState(false);
  const [roomMaxBookingHours, setRoomMaxBookingHours] = useState<number | undefined>(undefined);
  const [roomAmenities, setRoomAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roomImageFile, setRoomImageFile] = useState<File | null>(null);
  const [roomImagePreview, setRoomImagePreview] = useState<string>('');
  const [roomCategory, setRoomCategory] = useState<RoomCategory | undefined>(undefined);

  // Rental Slots Modal State
  const [isSlotsModalOpen, setIsSlotsModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [rentalSlots, setRentalSlots] = useState<RentalSlot[]>([]);
  const [newSlotDay, setNewSlotDay] = useState<number>(1);
  const [newSlotStart, setNewSlotStart] = useState<string>('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState<string>('17:00');
  const [newSlotPrice, setNewSlotPrice] = useState<number>(50);
  const [isAddingSlot, setIsAddingSlot] = useState(false);

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
      let response;
      const payload: any = {
        name: roomName,
        buildingId: roomBuildingId,
        capacity: Number(roomCapacity),
        description: roomDesc || undefined,
        status: roomStatus,
        isRentable: roomIsRentable,
        maxBookingHours: roomMaxBookingHours,
        amenities: JSON.stringify(roomAmenities),
        category: roomCategory || undefined,
      };

      if (editingRoomId) {
        if (roomImageFile) {
          const formData = new FormData();
          formData.append('name', roomName);
          formData.append('buildingId', roomBuildingId);
          formData.append('capacity', String(roomCapacity));
          if (roomDesc) formData.append('description', roomDesc);
          formData.append('status', roomStatus);
          formData.append('isRentable', String(roomIsRentable));
          formData.append('maxBookingHours', String(roomMaxBookingHours || ''));
          formData.append('amenities', JSON.stringify(roomAmenities));
          if (roomCategory) formData.append('category', roomCategory);
          formData.append('image', roomImageFile);
          response = await api.patch(`/rooms/${editingRoomId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } else {
          response = await api.patch(`/rooms/${editingRoomId}`, payload);
        }
        toast.success('Room successfully updated');
      } else {
        if (roomImageFile) {
          const formData = new FormData();
          formData.append('name', roomName);
          formData.append('buildingId', roomBuildingId);
          formData.append('capacity', String(roomCapacity));
          if (roomDesc) formData.append('description', roomDesc);
          formData.append('status', roomStatus);
          formData.append('isRentable', String(roomIsRentable));
          formData.append('amenities', JSON.stringify(roomAmenities));
          if (roomCategory) formData.append('category', roomCategory);
          formData.append('image', roomImageFile);
          response = await api.post('/rooms', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } else {
          response = await api.post('/rooms', payload);
        }
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

  // Parse amenities from room
  const parseAmenities = (amenitiesStr?: string): string[] => {
    if (!amenitiesStr) return [];
    try {
      return JSON.parse(amenitiesStr);
    } catch {
      return amenitiesStr.split(',').map((s: string) => s.trim());
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
    setRoomIsRentable(r.isRentable || false);
    setRoomMaxBookingHours(r.maxBookingHours);
    setRoomAmenities(parseAmenities(r.amenities as any));
    setRoomImageFile(null);
    setRoomImagePreview(r.imageUrl || '');
    setRoomCategory(r.category || undefined);
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
    setRoomIsRentable(false);
    setRoomMaxBookingHours(undefined);
    setRoomAmenities([]);
    setRoomImageFile(null);
    setRoomImagePreview('');
    setRoomCategory(undefined);
    setIsRoomModalOpen(true);
  };

  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setRoomImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRoomImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setRoomImageFile(null);
    setRoomImagePreview('');
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

  // Add amenity
  const handleAddAmenity = () => {
    if (newAmenity.trim() && !roomAmenities.includes(newAmenity.trim())) {
      setRoomAmenities([...roomAmenities, newAmenity.trim()]);
      setNewAmenity('');
    }
  };

  // Remove amenity
  const handleRemoveAmenity = (amenity: string) => {
    setRoomAmenities(roomAmenities.filter((a) => a !== amenity));
  };

  // Open Rental Slots Modal
  const handleOpenSlotsModal = (room: Room) => {
    setSelectedRoom(room);
    setIsSlotsModalOpen(true);
    fetchRentalSlots(room.id);
  };

  // Fetch rental slots
  const fetchRentalSlots = async (roomId: string) => {
    try {
      const res = await api.get(`/rentals/slots`, {
        params: { roomId },
      });
      setRentalSlots(res.data);
    } catch {
      toast.error('Failed to load rental slots');
    }
  };

  // Add rental slot
  const handleAddSlot = async () => {
    if (!selectedRoom) return;

    setIsAddingSlot(true);
    try {
      await api.post('/rentals/slots', {
        roomId: selectedRoom.id,
        dayOfWeek: newSlotDay,
        startTime: newSlotStart,
        endTime: newSlotEnd,
        price: newSlotPrice,
      });
      toast.success('Rental slot added');
      if (selectedRoom) {
        fetchRentalSlots(selectedRoom.id);
      }
      // Reset form
      setNewSlotDay(1);
      setNewSlotStart('09:00');
      setNewSlotEnd('17:00');
      setNewSlotPrice(50);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add slot');
    } finally {
      setIsAddingSlot(false);
    }
  };

  // Delete rental slot
  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this slot?')) return;

    try {
      await api.delete(`/rentals/slots/${slotId}`);
      toast.success('Slot deleted');
      if (selectedRoom) {
        fetchRentalSlots(selectedRoom.id);
      }
    } catch {
      toast.error('Failed to delete slot');
    }
  };

  // Toggle slot active status
  const handleToggleSlot = async (slot: RentalSlot) => {
    try {
      await api.patch(`/rentals/slots/${slot.id}`, {
        isActive: !slot.isActive,
      });
      toast.success('Slot updated');
      if (selectedRoom) {
        fetchRentalSlots(selectedRoom.id);
      }
    } catch {
      toast.error('Failed to update slot');
    }
  };

  // Table structures
  const buildingColumns = [
    {
      header: 'Building Name',
      accessor: 'name' as const,
      mobileTitle: true,
      cell: (b: Building) => (
        <span className="font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-400" />
          {b.name}
        </span>
      ),
    },
    {
      header: 'Total Rooms',
      cell: (b: Building) => {
        const count = rooms.filter((r) => r.buildingId === b.id).length;
        return <span className="font-semibold text-slate-600">{count} rooms</span>;
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (b: Building) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEditBuilding(b)}
            className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 p-1.5 rounded-lg transition-colors cursor-pointer"
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
      mobileTitle: true,
      cell: (r: Room) => (
        <div>
          <p className="font-bold text-slate-900">{r.name}</p>
          {r.description && <p className="text-xs text-slate-500 truncate max-w-xs mt-0.5">{r.description}</p>}
        </div>
      ),
    },
    {
      header: 'Assigned Building',
      mobileHidden: true,
      cell: (r: Room) => {
        const b = buildings.find((bl) => bl.id === r.buildingId);
        return <span className="font-semibold text-slate-600">{b?.name || 'Building'}</span>;
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
      header: 'Rentable',
      cell: (r: Room) => (
        <div className="flex flex-col gap-0.5">
          <Badge variant={r.isRentable ? 'success' : 'neutral'}>
            {r.isRentable ? 'Yes' : 'No'}
          </Badge>
          {r.maxBookingHours && (
            <span className="text-xs text-slate-500">Max: {r.maxBookingHours}h</span>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (r: Room) => (
        <div className="flex items-center justify-end gap-1.5">
          {r.isRentable && (
            <button
              onClick={() => handleOpenSlotsModal(r)}
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Configure Rental Slots"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleOpenEditRoom(r)}
            className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 p-1.5 rounded-lg transition-colors cursor-pointer"
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

  const slotColumns = [
    {
      header: 'Day',
      cell: (s: RentalSlot) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return <span className="font-medium text-slate-600">{days[s.dayOfWeek]}</span>;
      },
    },
    {
      header: 'Time',
      cell: (s: RentalSlot) => (
        <span className="text-slate-600">{s.startTime} - {s.endTime}</span>
      ),
    },
    {
      header: 'Price/hr',
      cell: (s: RentalSlot) => (
        <span className="font-bold text-emerald-400">${s.price}</span>
      ),
    },
    {
      header: 'Status',
      cell: (s: RentalSlot) => (
        <Badge variant={s.isActive ? 'success' : 'neutral'}>
          {s.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (s: RentalSlot) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleToggleSlot(s)}
          >
            {s.isActive ? 'Disable' : 'Enable'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDeleteSlot(s.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
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
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
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
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
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

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/40">
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
        size="lg"
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
            <Select
              label="Room Category"
              options={[
                { value: 'EVENT', label: 'EVENT' },
                { value: 'SPORT', label: 'SPORT' },
              ]}
              value={roomCategory || ''}
              onChange={(e) => setRoomCategory(e.target.value as RoomCategory || undefined)}
            />
          </div>

          {/* Available for Rent Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-300 bg-slate-100/30">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="font-semibold text-slate-800">Available for Rent</p>
                <p className="text-xs text-slate-500">Enable to allow renters to book this room</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={roomIsRentable}
                onChange={(e) => setRoomIsRentable(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Max Booking Hours (only shown when rentable) */}
          {roomIsRentable && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
                Max Booking Hours
              </label>
              <Input
                type="number"
                min={1}
                max={12}
                value={roomMaxBookingHours ?? ''}
                onChange={(e) => setRoomMaxBookingHours(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="e.g. 4 (leave empty for no limit)"
              />
              <p className="text-xs text-slate-500">Maximum hours a renter can book in one session. Leave empty for no limit.</p>
            </div>
          )}

          {/* Amenities Editor */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
              Amenities
            </label>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-slate-300 bg-white/30 min-h-[60px]">
              {roomAmenities.length === 0 && (
                <p className="text-sm text-slate-500">No amenities added</p>
              )}
              {roomAmenities.map((amenity, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-full"
                >
                  {amenity}
                  <button
                    type="button"
                    onClick={() => handleRemoveAmenity(amenity)}
                    className="hover:text-rose-400 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Add amenity (e.g., WiFi, Projector)"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAmenity())}
                className="flex-1"
              />
              <Button type="button" variant="secondary" onClick={handleAddAmenity}>
                Add
              </Button>
            </div>
          </div>

          <Input
            label="Room Description"
            type="text"
            placeholder="Brief description of the room"
            value={roomDesc}
            onChange={(e) => setRoomDesc(e.target.value)}
            leftIcon={<FileText className="w-4 h-4" />}
          />

          {/* Room Image Upload */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
              Room Image
            </label>
            {roomImagePreview ? (
              <div className="relative group">
                <img
                  src={roomImagePreview}
                  alt="Room preview"
                  className="w-full h-40 object-cover rounded-lg border border-slate-200/50"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 bg-rose-500/80 hover:bg-rose-500 rounded-full text-white transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-8 h-8 mb-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="mb-1 text-sm text-slate-500">
                    <span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-slate-500">PNG, JPG, WEBP (max 5MB)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </label>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/40">
            <Button type="button" variant="secondary" onClick={() => setIsRoomModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingRoomId ? 'Save Room' : 'Create Room'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rental Slots Modal */}
      <Modal
        isOpen={isSlotsModalOpen}
        onClose={() => setIsSlotsModalOpen(false)}
        title={`Rental Slots: ${selectedRoom?.name}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Add New Slot Form */}
          <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add New Rental Slot
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Select
                label="Day"
                options={[
                  { value: 0, label: 'Sunday' },
                  { value: 1, label: 'Monday' },
                  { value: 2, label: 'Tuesday' },
                  { value: 3, label: 'Wednesday' },
                  { value: 4, label: 'Thursday' },
                  { value: 5, label: 'Friday' },
                  { value: 6, label: 'Saturday' },
                ]}
                value={newSlotDay}
                onChange={(e) => setNewSlotDay(Number(e.target.value))}
              />
              <Input
                label="Start Time"
                type="time"
                value={newSlotStart}
                onChange={(e) => setNewSlotStart(e.target.value)}
              />
              <Input
                label="End Time"
                type="time"
                value={newSlotEnd}
                onChange={(e) => setNewSlotEnd(e.target.value)}
              />
              <Input
                label="Price/hr ($)"
                type="number"
                min={1}
                value={newSlotPrice}
                onChange={(e) => setNewSlotPrice(Number(e.target.value))}
              />
              <div className="flex items-end">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleAddSlot}
                  isLoading={isAddingSlot}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Existing Slots */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Current Rental Slots
            </h4>
            {rentalSlots.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No rental slots configured for this room</p>
            ) : (
              <DataTable
                columns={slotColumns}
                data={rentalSlots}
                emptyMessage="No slots configured for this room."
              />
            )}
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
