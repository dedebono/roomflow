'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { Shield, Server } from 'lucide-react';

interface HeaderProps {
  title: string;
  description?: string;
}

export const Header = ({ title, description }: HeaderProps) => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <header className="h-16 px-8 border-b border-slate-900 glass flex items-center justify-between">
      <div>
        <h1 className="text-base font-bold text-slate-100 tracking-tight">{title}</h1>
        {description && <p className="text-xs text-slate-400 font-medium">{description}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* API connection status */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
          <Server className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-400">REST API connected</span>
        </div>

        {/* User security status */}
        <div className="flex items-center gap-2 p-1.5 pl-3 rounded-lg bg-slate-900/60 border border-slate-800/40">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-300">Protected session</span>
        </div>
      </div>
    </header>
  );
};
