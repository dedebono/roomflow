'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Role } from '@/types';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  allowedRoles?: Role[];
}

export const DashboardLayout = ({
  children,
  title,
  description,
  allowedRoles,
}: DashboardLayoutProps) => {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && user && allowedRoles && !hasRole(allowedRoles)) {
      if (user.role === 'ADMIN_IT') {
        router.push('/system/users');
      } else if (user.role === 'ROOM_ADMIN') {
        router.push('/admin/bookings');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, loading, allowedRoles, hasRole, router]);

  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f1dece] dark:bg-[#1a1a1a] text-[#474547] gap-4">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-[#143258] flex items-center justify-center font-bold text-white text-lg tracking-wider">
            RF
          </div>
          <span className="font-bold text-2xl tracking-tight text-gray-900 dark:text-[#e8e8e8]">
            RoomFlow
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-400 dark:text-[#a8a8a8] font-medium text-sm">
          <svg className="animate-spin h-5 w-5 text-[#143258] dark:text-[#cbe2f0]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Resolving security session...</span>
        </div>
      </div>
    );
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1dece] dark:bg-[#1a1a1a] text-[#474547] dark:text-[#e8e8e8]">
      {/* Sidebar — desktop persistent, mobile drawer */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          description={description}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
