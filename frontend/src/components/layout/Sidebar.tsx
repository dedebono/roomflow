'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/Badge';
import {
  Calendar,
  BookOpen,
  Users,
  Building2,
  FolderLock,
  LogOut,
  BellRing,
  CreditCard,
  MessageSquare,
  Home,
  DollarSign,
  Bell,
  X,
} from 'lucide-react';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ open, onClose }: SidebarProps) => {
  const { user, logout, hasRole } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const isActive = (path: string) => pathname === path;

  const getLinkClass = (path: string) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 ${
      isActive(path)
        ? 'bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-md shadow-indigo-500/10'
        : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
    }`;

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'ADMIN_IT') return 'danger';
    if (role === 'ROOM_ADMIN') return 'info';
    if (role === 'RENTER') return 'success';
    return 'neutral';
  };

  const getRoleDisplayName = (role: string) => {
    if (role === 'ADMIN_IT') return 'IT Admin';
    if (role === 'ROOM_ADMIN') return 'Room Manager';
    if (role === 'RENTER') return 'Renter';
    return 'Employee';
  };

  const handleLinkClick = () => {
    onClose?.();
  };

  const sidebarContent = (
    <aside className="w-64 glass border-r border-slate-900 flex flex-col h-full">
      {/* Brand logo */}
      <div className="p-6 border-b border-slate-900 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white tracking-wider text-base shadow-lg shadow-indigo-500/20">
              RF
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-slate-100 to-slate-200">
              RoomFlow
            </span>
          </div>
          {/* Close button — mobile only */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div>
          <Badge variant={getRoleBadgeVariant(user.role)}>
            {getRoleDisplayName(user.role)}
          </Badge>
        </div>
      </div>

      {/* Navigation section */}
      <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5 overflow-y-auto">
        {/* Regular USER Links */}
        {hasRole(['USER']) && (
          <>
            <Link href="/dashboard" className={getLinkClass('/dashboard')} onClick={handleLinkClick}>
              <Calendar className="w-5 h-5" />
              <span>Book a Room</span>
            </Link>
            <Link href="/dashboard/bookings" className={getLinkClass('/dashboard/bookings')} onClick={handleLinkClick}>
              <BookOpen className="w-5 h-5" />
              <span>My Bookings</span>
            </Link>
          </>
        )}

        {/* RENTER Links */}
        {hasRole(['RENTER']) && (
          <>
            <Link href="/renter/dashboard" className={getLinkClass('/renter/dashboard')} onClick={handleLinkClick}>
              <Home className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>
            <Link href="/renter/rooms" className={getLinkClass('/renter/rooms')} onClick={handleLinkClick}>
              <Building2 className="w-5 h-5" />
              <span>Available Rooms</span>
            </Link>
            <Link href="/renter/bookings" className={getLinkClass('/renter/bookings')} onClick={handleLinkClick}>
              <Calendar className="w-5 h-5" />
              <span>My Bookings</span>
            </Link>
            <Link href="/renter/payments" className={getLinkClass('/renter/payments')} onClick={handleLinkClick}>
              <CreditCard className="w-5 h-5" />
              <span>Payments</span>
            </Link>
            <Link href="/renter/chat" className={getLinkClass('/renter/chat')} onClick={handleLinkClick}>
              <MessageSquare className="w-5 h-5" />
              <span>Messages</span>
            </Link>
          </>
        )}

        {/* ROOM_ADMIN Links */}
        {hasRole(['ROOM_ADMIN']) && (
          <>
            <Link href="/admin/bookings" className={getLinkClass('/admin/bookings')} onClick={handleLinkClick}>
              <Calendar className="w-5 h-5" />
              <span>Master Calendar</span>
            </Link>
            <Link href="/admin/rooms" className={getLinkClass('/admin/rooms')} onClick={handleLinkClick}>
              <Building2 className="w-5 h-5" />
              <span>Rooms & Buildings</span>
            </Link>
            <Link href="/rentals" className={getLinkClass('/rentals')} onClick={handleLinkClick}>
              <DollarSign className="w-5 h-5" />
              <span>Rental Bookings</span>
            </Link>
            <Link href="/chat" className={getLinkClass('/chat')} onClick={handleLinkClick}>
              <MessageSquare className="w-5 h-5" />
              <span>Chat with Renters</span>
            </Link>
            <Link href="/notifications" className={getLinkClass('/notifications')} onClick={handleLinkClick}>
              <Bell className="w-5 h-5" />
              <span>Notifications</span>
            </Link>
            <Link href="/admin/change-requests" className={getLinkClass('/admin/change-requests')} onClick={handleLinkClick}>
              <BellRing className="w-5 h-5" />
              <span>Change Requests</span>
            </Link>
          </>
        )}

        {/* ADMIN_IT Links */}
        {hasRole(['ADMIN_IT']) && (
          <>
            <Link href="/system/users" className={getLinkClass('/system/users')} onClick={handleLinkClick}>
              <Users className="w-5 h-5" />
              <span>User Control</span>
            </Link>
            <Link href="/system/storage" className={getLinkClass('/system/storage')} onClick={handleLinkClick}>
              <FolderLock className="w-5 h-5" />
              <span>Storage Systems</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer / User Profile section */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/40">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 border border-slate-700/50 flex-shrink-0">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/10 hover:border-rose-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <div className="hidden lg:flex w-64 min-h-screen flex-shrink-0 border-r border-slate-900 glass">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      <div 
        className={`fixed inset-0 z-50 flex transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Drawer panel */}
          <div 
            className={`relative z-10 flex h-full w-64 flex-shrink-0 transition-transform duration-300 transform ${
              open ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {sidebarContent}
          </div>
      </div>
    </>
  );
};
