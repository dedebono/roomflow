import { io, Socket } from 'socket.io-client';

class WebSocketClient {
  private socket: Socket | null = null;
  private url: string;
  private reconnectInterval: number = 3000;
  private maxReconnectDelay: number = 30000;
  private reconnectAttempts: number = 0;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(url?: string) {
    this.url = url || (typeof window !== 'undefined' && window.location.hostname.includes('room.ytcb.org')
      ? 'https://room.ytcb.org'
      : 'http://localhost:3001');
  }

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Also register with socket if connected
    if (this.socket) {
      this.socket.on(event, callback as any);
    }

    return () => {
      this.listeners.get(event)?.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback as any);
      }
    };
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
    if (this.socket) {
      this.socket.off(event, callback as any);
    }
  }

  emit(event: string, data?: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, { event, data });
    }
  }

  connect(): void {
    if (this.socket && this.socket.connected) {
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('roomflow_token') : null;

    const opts: any = {
      path: '/api/ws',
      transports: ['websocket', 'polling'],
      auth: {},
    };

    if (token) {
      opts.auth = { token };
    }

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(this.url, opts);

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.listeners.get('connect')?.forEach((cb) => cb());
    });

    this.socket.on('disconnect', () => {
      this.listeners.get('disconnect')?.forEach((cb) => cb());
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectDelay,
      );
      setTimeout(() => {
        if (!this.socket?.connected) {
          this.socket?.connect();
        }
      }, delay);
    });

    // Map incoming messages to our event listeners
    // Backend sends: { type: 'xxx', data: yyy }
    this.socket.on('message', (payload: any) => {
      try {
        const msg = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const eventName = msg.type;
        if (eventName) {
          this.listeners.get(eventName)?.forEach((cb) => cb(msg.data));
        }
      } catch { /* ignore */ }
    });

    // Direct event mappings from backend gateway
    this.socket.on('booking_update', (data: any) => {
      this.listeners.get('booking_update')?.forEach((cb) => cb(data));
    });

    this.socket.on('payment_update', (data: any) => {
      this.listeners.get('payment_update')?.forEach((cb) => cb(data));
    });

    this.socket.on('new_message', (data: any) => {
      this.listeners.get('new_message')?.forEach((cb) => cb(data));
    });

    this.socket.on('notification', (data: any) => {
      this.listeners.get('notification')?.forEach((cb) => cb(data));
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Singleton instance
const websocketClient = new WebSocketClient();

export default websocketClient;
