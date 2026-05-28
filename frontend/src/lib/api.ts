import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

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
          console.log('[api] token attached:', token.slice(0, 20) + '...');
        } else {
          console.log('[api] no token found in storage');
        }
      } catch (e) {
        console.error('[api] storage error:', e);
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
    console.log('[api] response:', response.status, typeof response.data, Array.isArray(response.data) ? response.data.length + ' items' : JSON.stringify(response.data)?.slice(0, 100));
    return response;
  },
  (error) => {
    console.error('[api] error:', error?.response?.status, error?.response?.data, error?.message, error?.code);
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
