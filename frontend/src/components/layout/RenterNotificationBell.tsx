'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, CheckCircle, Clock, DollarSign, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { Notification } from '@/types';
import toast from 'react-hot-toast';

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell = ({ className = '' }: NotificationBellProps) => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.slice(0, 20));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Track previous unread count to detect new notifications
  const prevUnreadRef = useRef(0);
  useEffect(() => {
    const unread = notifications.filter((n) => !n.read).length;
    if (unread > prevUnreadRef.current && prevUnreadRef.current > 0) {
      const latest = notifications.find((n) => !n.read);
      if (latest) {
        toast.success(latest.message || latest.title, {
          duration: 5000,
          icon: getNotifIconEl(latest.type),
        });
      }
    }
    prevUnreadRef.current = unread;
  }, [notifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = async (notif: Notification) => {
    try {
      await api.patch(`/notifications/${notif.id}/read`);
    } catch {
      // continue
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    if (notif.link) {
      router.push(notif.link);
    }
    setShowDropdown(false);
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silent
    }
  };

  const getNotifIcon = (type: string) => {
    if (
      type.includes('PAYMENT_APPROVED') ||
      type.includes('BOOKING_CONFIRMED') ||
      type.includes('RENTAL_BOOKED')
    ) {
      return '✅';
    }
    if (
      type.includes('PAYMENT_REJECTED') ||
      type.includes('BOOKING_CANCELLED')
    ) {
      return '❌';
    }
    if (
      type.includes('PAYMENT') ||
      type.includes('UPLOAD') ||
      type.includes('BOOKING_CREATED')
    ) {
      return '💳';
    }
    if (type.includes('EXPIRED')) {
      return '⏰';
    }
    return '🔔';
  };

  const getNotifIconEl = (type: string) => {
    if (
      type.includes('PAYMENT_APPROVED') ||
      type.includes('RENTAL_BOOKED')
    ) {
      return <CheckCircle className="w-5 h-5 text-emerald-400" />;
    }
    if (
      type.includes('PAYMENT_REJECTED') ||
      type.includes('EXPIRED')
    ) {
      return <AlertCircle className="w-5 h-5 text-rose-400" />;
    }
    if (
      type.includes('BOOKING_CREATED') ||
      type.includes('PAYMENT_PROOF_UPLOADED')
    ) {
      return <DollarSign className="w-5 h-5 text-amber-400" />;
    }
    return <Clock className="w-5 h-5 text-indigo-400" />;
  };

  const getNotifColor = (type: string) => {
    if (
      type.includes('PAYMENT_APPROVED') ||
      type.includes('RENTAL_BOOKED')
    ) {
      return 'border-emerald-500/30 bg-emerald-500/5';
    }
    if (
      type.includes('PAYMENT_REJECTED') ||
      type.includes('EXPIRED')
    ) {
      return 'border-rose-500/30 bg-rose-500/5';
    }
    if (
      type.includes('BOOKING_CREATED') ||
      type.includes('PAYMENT_PROOF_UPLOADED')
    ) {
      return 'border-amber-500/30 bg-amber-500/5';
    }
    return 'border-indigo-500/30 bg-indigo-500/5';
  };

  const rentalNotifs = notifications.filter((n) =>
    [
      'BOOKING_CREATED',
      'PAYMENT_PROOF_UPLOADED',
      'PAYMENT_APPROVED',
      'PAYMENT_REJECTED',
      'RENTAL_BOOKED',
      'BOOKING_EXPIRED',
    ].some((t) => n.type.includes(t))
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown((v) => !v)}
        className="relative p-2.5 rounded-xl hover:bg-slate-100/60 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 w-5 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div>
              <span className="text-sm font-bold text-slate-800">Booking Notifications</span>
              <p className="text-xs text-slate-500 mt-0.5">Payments & rentals</p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowDropdown(false)}
                className="p-1.5 rounded hover:bg-slate-100"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {rentalNotifs.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No booking notifications yet</p>
                <p className="text-xs text-slate-600 mt-1">Book a room to get started</p>
              </div>
            ) : (
              rentalNotifs.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left p-4 border-b border-slate-200 hover:bg-slate-100 transition-colors ${getNotifColor(notif.type)} ${!notif.read ? 'bg-opacity-20' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {getNotifIconEl(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-bold truncate ${!notif.read ? 'text-slate-900' : 'text-slate-500'}`}>
                          {notif.title}
                        </p>
                        <span className="text-xs">{getNotifIcon(notif.type)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1.5">
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
  );
}