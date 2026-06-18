'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Bell, X, Menu, Search, Plus } from 'lucide-react';
import api from '@/lib/api';
import { Notification } from '@/types';
import toast from 'react-hot-toast';

interface HeaderProps {
  title: string;
  description?: string;
  onMenuClick?: () => void;
}

export const Header = ({ title, description, onMenuClick }: HeaderProps) => {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.slice(0, 10));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    if (showNotifs) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifs]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = async (notif: Notification) => {
    try {
      await api.patch(`/notifications/${notif.id}/read`);
    } catch {
      // continue
    }
    if (notif.link) {
      router.push(notif.link);
    }
    setShowNotifs(false);
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const getNotifIcon = (type: string) => {
    if (type.includes('PAYMENT_APPROVED') || type.includes('BOOKING_CONFIRMED') || type.includes('RENTAL_BOOKED')) {
      return <span className="text-emerald-500">✓</span>;
    }
    if (type.includes('PAYMENT_REJECTED') || type.includes('BOOKING_CANCELLED')) {
      return <span className="text-rose-500">✗</span>;
    }
    if (type.includes('PAYMENT') || type.includes('UPLOAD')) {
      return <span className="text-amber-500">$</span>;
    }
    return <Bell className="w-3.5 h-3.5 text-[#143258]" />;
  };

  if (!user) return null;

  return (
    <header className="h-16 px-5 md:px-8 border-b border-gray-100 bg-[#fefefe] flex items-center justify-between gap-4 flex-shrink-0">
      {/* Left: hamburger (mobile) + title */}
      <div className="flex items-center gap-4 min-w-0">
        {/* Hamburger — mobile/tablet only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-black tracking-tight truncate">{title}</h1>
          {description && <p className="text-xs text-gray-500 font-normal hidden sm:block truncate">{description}</p>}
        </div>
      </div>

      {/* Center: Search bar */}
      <div className="hidden md:flex flex-1 max-w-md mx-auto">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search rooms, bookings..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#143258]/20 focus:border-[#143258]/30 transition-all"
          />
        </div>
      </div>

      {/* Right: global filters + CTA + notifications */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* CTA button */}
        <button
          onClick={() => router.push('/renter/rooms')}
          className="hidden sm:flex items-center gap-1.5 h-9 px-4 bg-[#143258] text-white text-sm font-medium rounded-lg hover:bg-[#0f2744] transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Booking</span>
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifs((v) => !v)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-sm bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-[#143258] hover:text-[#0f2744] font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifs(false)}
                    className="p-1.5 rounded hover:bg-gray-50"
                    aria-label="Close notifications"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        !notif.read ? 'bg-[#143258]/3' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">{getNotifIcon(notif.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${
                            !notif.read ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(notif.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="h-2 w-2 rounded-full bg-[#143258] mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-gray-500 text-xs flex-shrink-0">
          {user.name.charAt(0)}
        </div>
      </div>
    </header>
  );
};
