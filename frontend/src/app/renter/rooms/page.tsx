'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';
import { Room } from '@/types';
import toast from 'react-hot-toast';
import { Calendar, MapPin, Users } from 'lucide-react';
import Link from 'next/link';

const Badge = ({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }) => {
  const variants: Record<string, string> = {
    info: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    neutral: 'bg-slate-800 text-slate-400 border-slate-700/50',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${variants[variant]}`}>
      {children}
    </span>
  );
};

export default function AvailableRoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    fetchAvailableRooms();
  }, []);

  const fetchAvailableRooms = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (dateFilter) {
        params.date = dateFilter;
      }
      const res = await api.get(`/rentals/available-rooms?_=${Date.now()}`, { params });
      setDebugInfo(`res.data type: ${typeof res.data}, isArray: ${Array.isArray(res.data)}, keys: ${res.data && typeof res.data === 'object' ? Object.keys(res.data).join(',') : 'N/A'}, length: ${Array.isArray(res.data) ? res.data.length : 'N/A'}`);
      // Defensive: ensure res.data is an array
      const rawRooms = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      if (rawRooms.length === 0 && !dateFilter) {
        console.warn('[rooms] API returned 0 rooms — check backend response or auth');
      }
      // amenities may come as JSON string or array — normalise to array
      const normalised = rawRooms.map((room: any) => ({
        ...room,
        amenities: Array.isArray(room.amenities)
          ? room.amenities
          : typeof room.amenities === 'string'
            ? room.amenities
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [],
        imageUrl: room.imageUrl
          ? (room.imageUrl.startsWith('http') ? room.imageUrl : `${window.location.origin}${room.imageUrl}`)
          : undefined,
      }));
      setRooms(normalised);
    } catch (err: any) {
      console.error('[rooms] fetch error:', err?.response?.data, err?.message, err);
      toast.error('Failed to load available rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFilter(e.target.value);
  };

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (room.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border border-slate-900 glass">
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <Input
                label="Search Rooms"
                placeholder="Search by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<MapPin className="w-4 h-4" />}
              />
            </div>
            <div className="w-full sm:w-48">
              <Input
                label="Filter by Date"
                type="date"
                value={dateFilter}
                onChange={handleDateChange}
                onBlur={(e) => {
                  if (e.target.value && e.target.value !== dateFilter) {
                    setDateFilter(e.target.value);
                  }
                }}
                leftIcon={<Calendar className="w-4 h-4" />}
              />
            </div>
            <Button variant="secondary" onClick={() => {
              setSearchTerm('');
              setDateFilter('');
              fetchAvailableRooms();
            }}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Room Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-2" />
          <p>Loading rooms...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <Card className="border border-slate-900 glass text-center py-12">
          <CardContent>
            <p className="text-slate-400">No rooms available for the selected criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <Card key={room.id} className="border border-slate-900 glass flex flex-col overflow-hidden group hover:border-indigo-500/40 transition-all">
              {/* Room Image */}
              <div className="relative h-48 bg-slate-900 overflow-hidden">
                {room.imageUrl ? (
                  <img
                    src={room.imageUrl}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <MapPin className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <Badge variant={room.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {room.status}
                  </Badge>
                </div>
                {room.isRentable && (
                  <div className="absolute top-3 left-3">
                    <Badge variant="info">For Rent</Badge>
                  </div>
                )}
              </div>

              {/* Room Info */}
              <div className="p-4 flex flex-col flex-1">
                <h3 className="text-lg font-bold text-slate-100">{room.name}</h3>
                {room.description && (
                  <p className="text-sm text-slate-400 mt-1 line-clamp-2">{room.description}</p>
                )}

                <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {room.capacity} people
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {room.building?.name || 'Building'}
                  </span>
                </div>

                {/* Amenities */}
                {room.amenities && room.amenities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {room.amenities.slice(0, 4).map((amenity, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-800/60 text-slate-400 text-xs rounded-full"
                      >
                        {amenity}
                      </span>
                    ))}
                    {room.amenities.length > 4 && (
                      <span className="px-2 py-0.5 text-slate-500 text-xs">
                        +{room.amenities.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-auto pt-4">
                  <Link href={`/renter/rooms/${room.id}`}>
                    <Button variant="primary" className="w-full">
                      <Calendar className="w-4 h-4" />
                      Rent Now
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
