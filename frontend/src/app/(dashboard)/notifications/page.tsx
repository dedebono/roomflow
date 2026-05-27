'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import api from '@/lib/api';
import { Notification } from '@/types';
import toast from 'react-hot-toast';
import { Bell, BellRing, Calendar, CreditCard, CheckCircle, MessageSquare, AlertCircle } from 'lucide-react';
import { useWebSocket } from '@/lib/useWebSocket';

export default function NotificationsPage() {
  const { user, hasRole } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Determine allowed roles based on user
  const getAllowedRoles = () => {
    if (hasRole(['ROOM_ADMIN'])) return ['ROOM_ADMIN'];
    if (hasRole(['ADMIN_IT'])) return ['ADMIN_IT'];
    return ['USER', 'RENTER'];
  };

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // WebSocket for real-time notifications
  useWebSocket({
    onNotification: (data) => {
      // Add new notification to the list
      setNotifications((prev) => [data, ...prev]);
    },
  });

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  // Delete notification
  const handleDelete = async (notificationId: string) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      setNotifications((prev) =>
        prev.filter((n) => n.id !== notificationId)
      );
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'BOOKING_CREATED':
        return <Calendar className="w-5 h-5 text-indigo-400" />;
      case 'BOOKING_CONFIRMED':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'BOOKING_CANCELLED':
        return <AlertCircle className="w-5 h-5 text-rose-400" />;
      case 'PAYMENT_UPLOADED':
      case 'PAYMENT_APPROVED':
      case 'PAYMENT_REJECTED':
        return <CreditCard className="w-5 h-5 text-amber-400" />;
      case 'NEW_MESSAGE':
        return <MessageSquare className="w-5 h-5 text-blue-400" />;
      case 'RENTAL_BOOKED':
        return <Calendar className="w-5 h-5 text-violet-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const getTypeBadge = (type: string) => {
    if (type.includes('CONFIRMED') || type.includes('APPROVED')) {
      return 'success';
    }
    if (type.includes('CANCELLED') || type.includes('REJECTED')) {
      return 'danger';
    }
    if (type.includes('PENDING') || type.includes('UPLOADED')) {
      return 'warning';
    }
    return 'info';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = diff / (1000 * 60);
    const hours = minutes / 60;
    const days = hours / 24;

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${Math.floor(minutes)}m ago`;
    if (hours < 24) return `${Math.floor(hours)}h ago`;
    if (days < 7) return `${Math.floor(days)}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const columns = [
    {
      header: 'Notification',
      cell: (n: Notification) => (
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
            {getNotificationIcon(n.type)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className={`font-semibold ${n.read ? 'text-slate-400' : 'text-slate-200'}`}>
                {n.title}
              </p>
              {!n.read && (
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
              {n.message}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Type',
      cell: (n: Notification) => (
        <Badge variant={getTypeBadge(n.type) as any}>
          {n.type.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Time',
      cell: (n: Notification) => (
        <span className="text-sm text-slate-500">
          {formatTime(n.createdAt)}
        </span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (n: Notification) => (
        <div className="flex items-center justify-end gap-2">
          {!n.read && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleMarkAsRead(n.id)}
            >
              Mark Read
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(n.id)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const allowedRoles = getAllowedRoles();

  return (
    <DashboardLayout
      title="Notifications"
      description={unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
      allowedRoles={allowedRoles as any}
    >
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BellRing className="w-6 h-6 text-indigo-400" />
          <div>
            <h2 className="text-lg font-bold text-slate-100">Notifications</h2>
            <p className="text-sm text-slate-400">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up!'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={handleMarkAllAsRead}>
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <Card className="border border-slate-900 glass">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <p className="text-lg font-semibold text-slate-400">No notifications</p>
              <p className="text-sm text-slate-500 mt-1">You're all caught up!</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={notifications}
              emptyMessage="No notifications to display."
              isLoading={false}
            />
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
