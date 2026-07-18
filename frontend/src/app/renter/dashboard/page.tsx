'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { WelcomeCard } from '@/components/WelcomeCard';
import { StatCard } from '@/components/StatCard';
import { SectionCard } from '@/components/SectionCard';
import { ActivityItem } from '@/components/ActivityItem';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  CalendarDays,
  DoorOpen,
  CreditCard,
  Bell,
  Home,
  ArrowRight,
} from 'lucide-react';

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

const ACTIVITY_BADGE: Record<string, { label: string; type: 'booking' | 'payment' | 'message' | 'system' }> = {
  PAYMENT_APPROVED: { label: 'Paid', type: 'payment' },
  PAYMENT_REJECTED: { label: 'Rejected', type: 'payment' },
  PAYMENT_PROOF_UPLOADED: { label: 'Pending', type: 'payment' },
  BOOKING_CONFIRMED: { label: 'Confirmed', type: 'booking' },
  BOOKING_CREATED: { label: 'New', type: 'booking' },
  BOOKING_CANCELLED: { label: 'Cancelled', type: 'booking' },
  BOOKING_EXPIRED: { label: 'Expired', type: 'booking' },
  NEW_MESSAGE: { label: 'Message', type: 'message' },
  HOLD_EXPIRED: { label: 'Expired', type: 'system' },
  RENTAL_BOOKED: { label: 'Rented', type: 'booking' },
};

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
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

  const statVariants = ['navy', 'lightBlue', 'yellow', 'darkBlue'] as const;

  const statsCards = [
    {
      title: 'Total Rentals',
      value: loading ? '...' : String(stats?.totalBookings ?? 0),
      icon: <CalendarDays />,
      subtitle: 'All time',
    },
    {
      title: 'Active Bookings',
      value: loading ? '...' : String(stats?.activeBookings ?? 0),
      icon: <DoorOpen />,
      subtitle: 'Current',
    },
    {
      title: 'Pending Payments',
      value: loading ? '...' : String(stats?.pendingPayments ?? 0),
      icon: <CreditCard />,
      subtitle: 'Awaiting review',
    },
    {
      title: 'Available Rooms',
      value: loading ? '...' : String(stats?.availableRooms ?? 0),
      icon: <Home />,
      subtitle: 'Ready to book',
    },
  ];

  const quickLinks = [
    {
      title: 'Available Rooms',
      description: 'View all rentable rooms and book your preferred space',
      icon: <Home />,
      href: '/renter/rooms',
      badge: {
        label: loading ? '...' : `${stats?.availableRooms ?? 0} rooms`,
        className: 'bg-[#f7b917] text-[#143258] dark:bg-[#1a3a5c] dark:text-white border border-[#f7b917] dark:border-[#264da1]',
      },
    },
    {
      title: 'My Bookings',
      description: 'Check your booking history and current reservations',
      icon: <CalendarDays />,
      href: '/renter/bookings',
      badge: { label: 'View', className: 'bg-[#f7b917] text-black dark:bg-[#1a3a5c] dark:text-white' },
    },
    {
      title: 'Payments',
      description: 'Upload payment proofs and track payment status',
      icon: <CreditCard />,
      href: '/renter/payments',
      badge: { label: 'Upload', className: 'bg-[#f7b917] text-black dark:bg-[#1a3a5c] dark:text-white' },
    },
    {
      title: 'Notifications',
      description: 'Stay updated on booking and payment alerts',
      icon: <Bell />,
      href: '/notifications',
      badge: { label: 'Updates', className: 'bg-[#f7b917] text-[#143258] dark:bg-[#1a3a5c] dark:text-white border border-[#f7b917] dark:border-[#264da1]' },
    },
  ];

  return (
    <>
      {/* Welcome Banner */}
      <WelcomeCard
        userName={user?.name}
        cta={{ label: 'Browse Rooms', href: '/renter/rooms' }}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsCards.map((stat, i) => (
          <StatCard
            key={i}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            variant={statVariants[i]}
            subtitle={stat.subtitle}
          />
        ))}
      </div>

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-sm font-bold text-[#474547] dark:text-[#e8e8e8] mb-3 flex items-center gap-2">
          Quick Access
          <span className="text-xs font-normal text-[#747474] dark:text-[#a8a8a8]">
            — {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickLinks.map((link, i) => (
            <Link key={i} href={link.href} className="block">
              <SectionCard
                title={link.title}
                description={link.description}
                icon={link.icon}
                badge={link.badge}
              >
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#264da1] dark:text-[#93c5fd]">
                  <span>Go</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </SectionCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-sm font-bold text-[#474547] dark:text-[#e8e8e8] mb-3">
          Recent Activity
        </h2>
        <SectionCard
          title="Activity Feed"
          badge={{ label: 'Live', className: 'bg-[#f7b917] text-black dark:bg-[#1a3a5c] dark:text-white' }}
          hoverable={false}
        >
          {loading ? (
            <p className="text-sm text-[#747474] dark:text-[#a8a8a8] italic py-2">
              Loading...
            </p>
          ) : !stats?.recentActivity?.length ? (
            <p className="text-sm text-[#747474] dark:text-[#a8a8a8] italic py-2">
              No recent activity
            </p>
          ) : (
            <div>
              {stats.recentActivity.map((item) => {
                const badgeInfo = ACTIVITY_BADGE[item.type] ?? { label: item.type.replace(/_/g, ' '), type: 'system' as const };
                return (
                  <ActivityItem
                    key={item.id}
                    title={item.title}
                    description={item.message}
                    time={timeAgo(item.createdAt)}
                    badge={{ label: badgeInfo.label, type: badgeInfo.type }}
                  />
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}