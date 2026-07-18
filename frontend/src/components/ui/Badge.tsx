import React, { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}

export const Badge = ({ children, variant = 'neutral', className = '' }: BadgeProps) => {
  const variants = {
    info: 'bg-[#cbe2f0] text-[#143258] border-[#cbe2f0]',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    warning: 'bg-[#f7b917] text-[#143258] border-[#f7b917]',
    danger: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    neutral: 'bg-[#cbe2f0] text-[#747474] border-[#cbe2f0]',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};