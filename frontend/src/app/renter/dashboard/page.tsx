'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Home, CalendarDays, CreditCard, Bell, DoorOpen, MessageSquare } from 'lucide-react';

interface Stats {
  totalBookings: number;
  activeBookings: number;
  pendingPayments: number;
  availableRooms: number;
  recentActivity: {
    id: string;
    type: string;
    title: string;
    message: string | null;
    createdAt: string;
  }[];
}

const BADGE_VARIANTS: Record<string, string> = {
  PAYMENT_APPROVED: 'success',
    PAYMENT_REJECTED: 'danger',
    PAYMENT_PROOF_UPLOADED: 'warning',
    BOOKING_CONFIRMED: 'success',
    BOOKING_CREATED: 'info',
    BOOKING_CANCELLED: 'danger',
    BOOKING_EXPIRED: 'neutral',
    NEW_MESSAGE: 'info',
    HOLD_EXPIRED: 'neutral',
    RENTAL_BOOKED: 'success',
    default: 'neutral',
  };

function getActivityBadge(type: string): string {
  return BADGE_VARIANTS[type] || BADGE_VARIANTS.default;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function RenterDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/rentals/stats')
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statsCards = [
    {
      title: 'Total Rentals',
      value: loading ? '...' : String(stats?.totalBookings ?? 0),
      icon: <CalendarDays className="w-5 h-5 text-indigo-400" />,
      variant: 'info' as const,
    },
    {
      title: 'Active Bookings',
      value: loading ? '...' : String(stats?.activeBookings ?? 0),
      icon: <DoorOpen className="w-5 h-5 text-emerald-400" />,
      variant: 'success' as const,
    },
    {
      title: 'Pending Payments',
      value: loading ? '...' : String(stats?.pendingPayments ?? 0),
      icon: <CreditCard className="w-5 h-5 text-amber-400" />,
      variant: 'warning' as const,
    },
  ];

  return (
    <>
      {/* Welcome Section */}
      <Card className="border border-slate-900 glass bg-gradient-to-r from-indigo-950/40 to-slate-900/40">
        <CardContent>
          <div className="flex flex-col sm:items-center sm:flex-row gap-4">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xl text-indigo-400 border border-indigo-500/20">
              {user?.name?.charAt(0) || 'R'}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900">
                Welcome back{user?.name ? `, ${user.name}` : ''}!
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Browse available rooms and manage your bookings from here.
              </p>
            </div>
            <Link href="/renter/rooms">
              <Button variant="primary">
                <DoorOpen className="w-4 h-4" />
                Browse Rooms
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statsCards.map((stat, idx) => (
          <Card key={idx} className="border border-slate-900 glass">
            <CardHeader className="p-0 mb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-slate-500">{stat.title}</CardTitle>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/renter/rooms">
          <Card className="border border-slate-900 glass hover:border-indigo-500/40 hover:-translate-y-0.5 transition-all cursor-pointer">
            <CardHeader className="p-0 mb-2">
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5 text-indigo-400" />
                Available Rooms
              </CardTitle>
              <Badge variant="info">
                {loading ? '...' : stats?.availableRooms ?? 0} rooms
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-sm text-slate-500">View all rentable rooms and book your preferred space</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/renter/bookings">
          <Card className="border border-slate-900 glass hover:border-indigo-500/40 hover:-translate-y-0.5 transition-all cursor-pointer">
            <CardHeader className="p-0 mb-2">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-emerald-400" />
                My Bookings
              </CardTitle>
              <Badge variant="success">View</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-sm text-slate-500">Check your booking history and current reservations</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/renter/payments">
          <Card className="border border-slate-900 glass hover:border-indigo-500/40 hover:-translate-y-0.5 transition-all cursor-pointer">
            <CardHeader className="p-0 mb-2">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                Payments
              </CardTitle>
              <Badge variant="warning">Upload</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-sm text-slate-500">Upload payment proofs and track payment status</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="border border-slate-900 glass">
          <CardHeader className="p-0 mb-2">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-rose-400" />
              Recent Activity
            </CardTitle>
            <Badge variant="neutral">Updates</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-slate-500 italic">Loading...</p>
            ) : !stats?.recentActivity?.length ? (
              <p className="text-sm text-slate-500 italic">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                      {item.message && (
                        <p className="text-xs text-slate-500 truncate">{item.message}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={getActivityBadge(item.type) as any}>{item.type.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-slate-400">{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}