'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect based on role
        if (user.role === 'ADMIN_IT') {
          router.push('/system/users');
        } else if (user.role === 'ROOM_ADMIN') {
          router.push('/admin/bookings');
        } else {
          router.push('/dashboard');
        }
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 gap-6">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white text-2xl tracking-wider shadow-lg shadow-indigo-500/30">
          RF
        </div>
        <span className="font-extrabold text-4xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-slate-100 to-slate-200">
          RoomFlow
        </span>
      </div>
      <div className="flex items-center gap-2 text-indigo-400 font-semibold text-base">
        <svg className="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Setting up your workspace...</span>
      </div>
    </div>
  );
}