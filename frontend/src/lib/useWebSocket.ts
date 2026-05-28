'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import websocketClient from './websocket';

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
    return localStorage;
  } catch {
    try {
      sessionStorage.setItem('__test__', '1');
      sessionStorage.removeItem('__test__');
      return sessionStorage;
    } catch {
      return null;
    }
  }
}

export interface WebSocketMessage {
  event: string;
  data: any;
}

export interface UseWebSocketOptions {
  onBookingUpdate?: (data: any) => void;
  onPaymentUpdate?: (data: any) => void;
  onNewMessage?: (data: any) => void;
  onNotification?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const optionsRef = useRef(options);
  
  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const handleMessage = useCallback((data: any) => {
    setLastMessage(data);
    
    const handlers: Record<string, (data: any) => void> = {
      booking_update: optionsRef.current.onBookingUpdate || (() => {}),
      payment_update: optionsRef.current.onPaymentUpdate || (() => {}),
      new_message: optionsRef.current.onNewMessage || (() => {}),
      notification: optionsRef.current.onNotification || (() => {}),
    };

    if (data.event && handlers[data.event]) {
      handlers[data.event](data.data);
    }
  }, []);

  useEffect(() => {
    // Set up event listeners
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      websocketClient.on('booking_update', (data: any) => {
        handleMessage({ event: 'booking_update', data });
      })
    );

    unsubscribers.push(
      websocketClient.on('payment_update', (data: any) => {
        handleMessage({ event: 'payment_update', data });
      })
    );

    unsubscribers.push(
      websocketClient.on('new_message', (data: any) => {
        handleMessage({ event: 'new_message', data });
      })
    );

    unsubscribers.push(
      websocketClient.on('notification', (data: any) => {
        handleMessage({ event: 'notification', data });
      })
    );

    websocketClient.on('connect', () => {
      setIsConnected(true);
      optionsRef.current.onConnect?.();
    });

    websocketClient.on('disconnect', () => {
      setIsConnected(false);
      optionsRef.current.onDisconnect?.();
    });

    // Connect if not already connected
    websocketClient.connect();

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [handleMessage]);

  const sendMessage = useCallback((event: string, data?: any) => {
    websocketClient.emit(event, data);
  }, []);

  return {
    isConnected,
    lastMessage,
    sendMessage,
  };
}

// Hook to track unread message count
export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = websocketClient.on('new_message', (data: any) => {
      setUnreadCount((prev: number) => prev + 1);
    });

    // Also poll for initial unread count
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/chat/unread-count', {
          headers: {
            Authorization: `Bearer ${getStorage()?.getItem('roomflow_token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.count || 0);
        }
      } catch {
        // Ignore errors
      }
    };
    fetchUnreadCount();

    return () => {
      unsubscribe();
    };
  }, []);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { unreadCount, clearUnread };
}
