'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Shield, Server, Bell, X, Menu } from 'lucide-react';
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
      return <span className="text-emerald-400">✓</span>;
    }
    if (type.includes('PAYMENT_REJECTED') || type.includes('BOOKING_CANCELLED')) {
      return <span className="text-rose-400">✗</span>;
    }
    if (type.includes('PAYMENT') || type.includes('UPLOAD')) {
      return <span className="text-amber-400">$</span>;
    }
    return <Bell className="w-3.5 h-3.5 text-indigo-400" />;
  };

  if (!user) return null;

  return (
    <header className="h-14 md:h-16 px-4 md:px-8 border-b border-slate-900 glass flex items-center justify-between gap-3 flex-shrink-0">
      {/* Left: hamburger (mobile) + title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile/tablet only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm md:text-base font-bold text-slate-100 tracking-tight truncate">{title}</h1>
          {description && <p className="text-xs text-slate-400 font-medium hidden sm:block truncate">{description}</p>}
        </div>
      </div>

      {/* Right: status + bell + session badge */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        {/* API connection status — desktop only */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
          <Server className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-400">REST API connected</span>
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifs((v) => !v)}
            className="relative p-2.5 rounded-lg hover:bg-slate-800/50 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-slate-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-200">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifs(false)}
                    className="p-1.5 rounded hover:bg-slate-800"
                    aria-label="Close notifications"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left p-3 border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors ${
                        !notif.read ? 'bg-indigo-500/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">{getNotifIcon(notif.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${
                            !notif.read ? 'text-slate-100' : 'text-slate-400'
                          }`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-slate-600 mt-1">
                            {new Date(notif.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User security status — hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-2 p-1.5 pl-3 rounded-lg bg-slate-900/60 border border-slate-800/40">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-300">Protected session</span>
        </div>
      </div>
    </header>
  );
};
