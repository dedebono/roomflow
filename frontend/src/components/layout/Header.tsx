'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Bell, X, Menu, Search, Plus, Sun, Moon } from 'lucide-react';
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
  const [isDark, setIsDark] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark');
    setIsDark(dark);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      setIsDark(true);
    }
  };
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

  const [search, setSearch] = useState('');
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/renter/rooms?q=${encodeURIComponent(q)}` : '/renter/rooms');
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
    <header className="h-16 px-5 md:px-8 border-b border-[#cbe2f0] dark:border-[#3a3a3a] bg-[#fefefe] dark:bg-[#2a2a2a] flex items-center justify-between gap-4 flex-shrink-0">
    {/* Left: hamburger (mobile) + title */}
    <div className="flex items-center gap-4 min-w-0">
      {/* Hamburger — mobile/tablet only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-[#cbe2f0] text-[#747474] dark:text-[#a8a8a8] hover:text-[#143258] dark:hover:text-[#e8e8e8] transition-colors flex-shrink-0"
        aria-label="Open menu"
      >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[#143258] dark:text-[#cbe2f0] tracking-tight truncate">{title}</h1>
          {description && <p className="text-xs text-[#747474] dark:text-[#a8a8a8] font-normal hidden sm:block truncate">{description}</p>}
        </div>
      </div>

      {/* Center: Search bar */}
      <div className="hidden md:flex flex-1 max-w-md mx-auto">
        <form onSubmit={handleSearch} className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#747474] dark:text-[#a8a8a8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms, bookings..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#cbe2f0] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-sm text-[#474547] dark:text-[#e8e8e8] placeholder:text-[#747474] dark:placeholder:text-[#a8a8a8] focus:outline-none focus:ring-1 focus:ring-[#264da1]/30 focus:border-[#264da1]/40 transition-all"
          />
        </form>
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
            className="relative p-2 rounded-lg hover:bg-[#cbe2f0] dark:hover:bg-[#3a3a3a] transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-[#474547] dark:text-[#e8e8e8]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center bg-[#f7b917] text-[#143258] text-[10px] font-bold rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-sm bg-[#fefefe] dark:bg-[#2a2a2a] border border-[#cbe2f0] dark:border-[#3a3a3a] rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-[#cbe2f0] dark:border-[#3a3a3a]">
                <span className="text-sm font-semibold text-[#474547] dark:text-[#e8e8e8]">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-[#143258] dark:text-[#93c5fd] hover:text-[#0f2744] dark:hover:text-[#bfd8f5] font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifs(false)}
                    className="p-1.5 rounded hover:bg-[#cbe2f0] dark:hover:bg-[#3a3a3a]"
                    aria-label="Close notifications"
                  >
                    <X className="w-4 h-4 text-[#747474] dark:text-[#a8a8a8]" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-[#747474] dark:text-[#a8a8a8] text-sm">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left p-3 border-b border-[#cbe2f0] dark:border-[#3a3a3a] hover:bg-[#cbe2f0]/20 dark:hover:bg-[#3a3a3a] transition-colors ${
                        !notif.read ? 'bg-[#143258]/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">{getNotifIcon(notif.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${
                            !notif.read ? 'text-[#474547] dark:text-[#e8e8e8]' : 'text-[#747474] dark:text-[#a8a8a8]'
                          }`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-[#747474] dark:text-[#a8a8a8] mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-[#747474] dark:text-[#a8a8a8] mt-1">
                            {new Date(notif.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="h-2 w-2 rounded-full bg-[#f7b917] mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-[#cbe2f0] dark:hover:bg-[#3a3a3a] transition-colors"
          aria-label="Toggle dark mode"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-[#f7b917]" />
          ) : (
            <Moon className="w-5 h-5 text-[#143258]" />
          )}
        </button>

        {/* User avatar */}
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center font-semibold text-white text-xs flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #143258, #264da1)' }}
        >
          {user.name.charAt(0)}
        </div>
      </div>
    </header>
  );
};
