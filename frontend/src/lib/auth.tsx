'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';
import { User, Role } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, whatsappNumber?: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: Role[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage helper — localStorage first, sessionStorage fallback for restricted envs
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

const TOKEN_KEY = 'roomflow_token';
const USER_KEY  = 'roomflow_user';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const storage = getStorage();
    if (storage) {
      const storedToken = storage.getItem(TOKEN_KEY);
      const storedUser  = storage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        setToken(storedToken);
        try { setUser(JSON.parse(storedUser)); } catch { /* ignore */ }
      }
    }
    setLoading(false);
  }, []);

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      const updated = res.data;
      const storage = getStorage();
      if (storage) storage.setItem(USER_KEY, JSON.stringify(updated));
      setUser(updated);
    } catch {
      // ignore
    }
  };

  const login = async (email: string, password: string) => {
    console.log('[auth] attempting login for:', email);
    const response = await api.post('/auth/login', { email, password });
    const { access_token, user: loggedUser } = response.data;
    console.log('[auth] login response:', response.status, response.data);

    const storage = getStorage();
    if (storage) {
      storage.setItem(TOKEN_KEY, access_token);
      storage.setItem(USER_KEY,  JSON.stringify(loggedUser));
      console.log('[auth] token persisted to storage:', access_token.slice(0, 20) + '...');
    } else {
      console.warn('[auth] storage unavailable, token NOT persisted');
    }

    setToken(access_token);
    setUser(loggedUser);

    // If WhatsApp number provided but not verified, redirect to OTP page
    if (loggedUser.whatsappNumber && !loggedUser.whatsappVerified) {
      const storage = getStorage();
      if (storage) storage.setItem('verify_email', email);
      router.push('/verify-whatsapp?mode=resend');
      return;
    }

    if (loggedUser.role === 'ADMIN_IT')      router.push('/system/users');
    else if (loggedUser.role === 'ROOM_ADMIN') router.push('/dashboard');
    else if (loggedUser.role === 'RENTER')     router.push('/renter/dashboard');
    else                                       router.push('/dashboard');
  };

  const register = async (name: string, email: string, password: string, whatsappNumber?: string) => {
    await api.post('/auth/register', { name, email, password, whatsappNumber });

    if (whatsappNumber) {
      // Store email for verify-whatsapp page (sessionStorage persists across navigation within same tab)
      const storage = getStorage();
      if (storage) storage.setItem('verify_email', email);
      router.push('/verify-whatsapp');
    } else {
      router.push('/login');
    }
  };

  const logout = () => {
    const storage = getStorage();
    if (storage) { storage.removeItem(TOKEN_KEY); storage.removeItem(USER_KEY); }
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const hasRole = (roles: Role[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, hasRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
