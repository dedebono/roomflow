'use client';

import React, { ReactNode } from 'react';

type StatCardVariant = 'navy' | 'darkBlue' | 'lightBlue' | 'yellow';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  variant?: StatCardVariant;
  subtitle?: string;
  className?: string;
}

const variantStyles: Record<StatCardVariant, { bg: string; iconCircle: string; icon: string; title: string; value: string; subtitle: string }> = {
  navy: {
    bg: 'bg-gradient-to-br from-[#143258] to-[#264da1]',
    iconCircle: 'bg-white/20',
    icon: 'text-white',
    title: 'text-white/70',
    value: 'text-white',
    subtitle: 'text-white/60',
  },
  darkBlue: {
    bg: 'bg-gradient-to-br from-[#264da1] to-[#143258]',
    iconCircle: 'bg-white/20',
    icon: 'text-white',
    title: 'text-white/70',
    value: 'text-white',
    subtitle: 'text-white/60',
  },
  lightBlue: {
    bg: 'bg-[#cbe2f0]',
    iconCircle: 'bg-[#143258]/15 dark:bg-white/10',
    icon: 'text-[#143258] dark:text-[#cbe2f0]',
    title: 'text-[#143258]/70 dark:text-[#cbe2f0]',
    value: 'text-[#143258] dark:text-[#e8e8e8]',
    subtitle: 'text-[#143258]/60 dark:text-[#a8a8a8]',
  },
  yellow: {
    bg: 'bg-gradient-to-br from-[#f7b917] to-[#f4a006]',
    iconCircle: 'bg-[#143258]/15',
    icon: 'text-[#143258]',
    title: 'text-[#143258]/70',
    value: 'text-[#143258]',
    subtitle: 'text-[#143258]/60',
  },
};

export const StatCard = ({
  title,
  value,
  icon,
  variant = 'navy',
  subtitle,
  className = '',
}: StatCardProps) => {
  const s = variantStyles[variant];
  const isDark = variant === 'navy' || variant === 'darkBlue';

  return (
    <div className={`${s.bg} rounded-2xl p-5 flex flex-col gap-3 shadow-md ${className}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${s.title}`}>{title}</span>
        <div className={`${s.iconCircle} rounded-xl p-2.5 flex items-center justify-center`}>
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
            className: `w-5 h-5 ${s.icon}`,
          })}
        </div>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${s.value}`}>{value}</p>
      {subtitle && (
        <p className={`text-xs ${s.subtitle}`}>{subtitle}</p>
      )}
    </div>
  );
};