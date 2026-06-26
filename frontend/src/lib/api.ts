import axios from 'axios';
import type { PaymentGateway, CreatePaymentGatewayDto, UpdatePaymentGatewayDto, PaymentGatewayPublic } from '@/types/payment-gateway';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to construct full image URLs
export function getImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/uploads/')) {
    return `${BASE_URL}${path}`;
  }
  return path;
}

// Storage helper — mirrors auth.tsx getStorage() so api interceptor finds the same token
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

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      try {
        const storage = getStorage();
        const token = storage?.getItem('roomflow_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // storage error, continue without token
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        try {
          const storage = getStorage();
          storage?.removeItem('roomflow_token');
          storage?.removeItem('roomflow_user');
        } catch {
          // storage blocked
        }
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Payment Gateways API
export const paymentGatewaysApi = {
  getAll: async (): Promise<PaymentGateway[]> => {
    const response = await api.get('/payment-gateways');
    return response.data;
  },
  getById: async (id: string): Promise<PaymentGateway> => {
    const response = await api.get(`/payment-gateways/${id}`);
    return response.data;
  },
  create: async (data: CreatePaymentGatewayDto): Promise<PaymentGateway> => {
    const response = await api.post('/payment-gateways', data);
    return response.data;
  },
  update: async (id: string, data: UpdatePaymentGatewayDto): Promise<PaymentGateway> => {
    const response = await api.patch(`/payment-gateways/${id}`, data);
    return response.data;
  },
  toggle: async (id: string, enabled: boolean): Promise<PaymentGateway> => {
    const response = await api.patch(`/payment-gateways/${id}/toggle`, { enabled });
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/payment-gateways/${id}`);
  },
  getAvailable: async (): Promise<PaymentGatewayPublic[]> => {
    const response = await api.get('/payment-gateways/available');
    return response.data;
  },
};
