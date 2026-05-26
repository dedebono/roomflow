import React, { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}

export const Badge = ({ children, variant = 'neutral', className = '' }: BadgeProps) => {
  const variants = {
    info: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    neutral: 'bg-slate-800 text-slate-400 border-slate-700/50',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
