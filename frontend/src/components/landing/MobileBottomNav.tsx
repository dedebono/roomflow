"use client";
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Search, Trophy, Calendar, User } from 'lucide-react';

export const MobileBottomNav = () => {
  const router = useRouter();
  return (
    <nav aria-label="Primary" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t-2 border-[#FDE68A] safe-bottom shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
      <div className="grid grid-cols-5 gap-1 px-1 py-1">
        {[
          { label: 'Home', icon: Home, href: '/' },
          { label: 'Venues', icon: Search, href: '#featured' },
          { label: 'Sports', icon: Trophy, href: '#sports' },
          { label: 'Events', icon: Calendar, href: '#events' },
          { label: 'Login', icon: User, href: '/login' },
        ].map(({ label, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl touch-target text-[#57534E] hover:text-[#0F172A] hover:bg-[#FFFBEB] active:bg-[#FDE68A] transition-colors"
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-widest uppercase leading-none">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};
