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
  Bell,
  BellRing,
  CreditCard,
  MessageSquare,
  Home,
  DollarSign,
  Phone,
  X,
  LayoutDashboard,
  Wallet,
  Settings,
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
    `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
      isActive(path)
        ? 'bg-white/15 text-white shadow-sm'
        : 'text-white/60 hover:bg-white/8 hover:text-white/80'
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
    <aside className="w-64 bg-[#143258] flex flex-col h-full">
      {/* Brand logo */}
      <div className="p-5 border-b border-white/8 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center font-bold text-white tracking-wider text-base">
              RF
            </div>
            <span className="font-bold text-base tracking-tight text-white/90">
              RoomFlow
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div>
          <Badge variant={getRoleBadgeVariant(user.role)}>
            {getRoleDisplayName(user.role)}
          </Badge>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {/* Section heading */}
        <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/30 font-semibold">Main</div>

        {/* Regular USER Links */}
        {hasRole(['USER']) && (
          <>
            <Link href="/dashboard" className={getLinkClass('/dashboard')} onClick={handleLinkClick}>
              <Calendar className="w-4 h-4" />
              <span>Book a Room</span>
            </Link>
            <Link href="/dashboard/bookings" className={getLinkClass('/dashboard/bookings')} onClick={handleLinkClick}>
              <BookOpen className="w-4 h-4" />
              <span>My Bookings</span>
            </Link>
          </>
        )}

        {/* RENTER Links */}
        {hasRole(['RENTER']) && (
          <>
            <Link href="/renter/dashboard" className={getLinkClass('/renter/dashboard')} onClick={handleLinkClick}>
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <Link href="/renter/rooms" className={getLinkClass('/renter/rooms')} onClick={handleLinkClick}>
              <Building2 className="w-4 h-4" />
              <span>Available Rooms</span>
            </Link>
            <Link href="/renter/bookings" className={getLinkClass('/renter/bookings')} onClick={handleLinkClick}>
              <Calendar className="w-4 h-4" />
              <span>My Bookings</span>
            </Link>
            <Link href="/renter/payments" className={getLinkClass('/renter/payments')} onClick={handleLinkClick}>
              <CreditCard className="w-4 h-4" />
              <span>Payments</span>
            </Link>
          </>
        )}

        {/* Admin section */}

        {/* ROOM_ADMIN Links */}
        {hasRole(['ROOM_ADMIN']) && (
          <>
            <div className="px-3 py-2 mt-2 text-[10px] uppercase tracking-widest text-white/30 font-semibold">Projects</div>
            <Link href="/admin/bookings" className={getLinkClass('/admin/bookings')} onClick={handleLinkClick}>
              <Calendar className="w-4 h-4" />
              <span>Master Calendar</span>
            </Link>
            <Link href="/admin/rooms" className={getLinkClass('/admin/rooms')} onClick={handleLinkClick}>
              <Building2 className="w-4 h-4" />
              <span>Rooms & Buildings</span>
            </Link>
            <Link href="/rentals" className={getLinkClass('/rentals')} onClick={handleLinkClick}>
              <DollarSign className="w-4 h-4" />
              <span>Rental Bookings</span>
            </Link>
            <Link href="/chat" className={getLinkClass('/chat')} onClick={handleLinkClick}>
              <MessageSquare className="w-4 h-4" />
              <span>Chat with Renters</span>
            </Link>
            <Link href="/notifications" className={getLinkClass('/notifications')} onClick={handleLinkClick}>
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
            </Link>
            <Link href="/admin/change-requests" className={getLinkClass('/admin/change-requests')} onClick={handleLinkClick}>
              <BellRing className="w-4 h-4" />
              <span>Change Requests</span>
            </Link>
          </>
        )}

        {/* Members section */}
        {hasRole(['ADMIN_IT']) && (
          <>
            <div className="px-3 py-2 mt-2 text-[10px] uppercase tracking-widest text-white/30 font-semibold">Members</div>
            <Link href="/system/users" className={getLinkClass('/system/users')} onClick={handleLinkClick}>
              <Users className="w-4 h-4" />
              <span>User Control</span>
            </Link>
            <Link href="/system/storage" className={getLinkClass('/system/storage')} onClick={handleLinkClick}>
              <FolderLock className="w-4 h-4" />
              <span>Storage Systems</span>
            </Link>
            <Link href="/system/payment-gateways" className={getLinkClass('/system/payment-gateways')} onClick={handleLinkClick}>
              <Wallet className="w-4 h-4" />
              <span>Payment Gateways</span>
            </Link>
            <Link href="/system/waha-settings" className={getLinkClass('/system/waha-settings')} onClick={handleLinkClick}>
              <Settings className="w-4 h-4" />
              <span>WAHA Settings</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer / User Profile section */}
      <div className="p-4 border-t border-white/8">
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-white/70 text-sm flex-shrink-0">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/80 truncate">{user.name}</p>
            <p className="text-xs text-white/40 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/8 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:flex w-64 min-h-screen flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      <div 
        className={`fixed inset-0 z-50 flex transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
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
