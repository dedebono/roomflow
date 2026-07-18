'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';

interface WelcomeCardProps {
  userName?: string;
  title?: string;
  description?: string;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  actions?: ReactNode;
  className?: string;
}

export const WelcomeCard = ({
  userName,
  title,
  description,
  cta,
  actions,
  className = '',
}: WelcomeCardProps) => {
  const displayTitle = title ?? (userName ? `Welcome back, ${userName}!` : 'Welcome back!');
  const displayDesc =
    description ??
    'Browse available rooms and manage your bookings from here.';

  return (
    <div
      className={`
        bg-gradient-to-r from-[#143258] to-[#264da1]
        rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4
        shadow-md ${className}
      `}
    >
      {/* Avatar */}
      <div
        className="h-14 w-14 rounded-full flex items-center justify-center font-bold text-2xl text-[#143258] dark:text-[#fefefe] border-2 border-white/30 shrink-0"
        style={{ background: '#f7b917' }}
      >
        {userName?.charAt(0) || 'R'}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-bold !text-white">{displayTitle}</h2>
        <p className="text-sm !text-white/70 mt-0.5">{displayDesc}</p>
      </div>

      {/* Actions */}
      {actions ? (
        actions
      ) : cta ? (
        cta.href ? (
          <Link
            href={cta.href}
            onClick={cta.onClick}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-blue-900 dark:text-black hover:bg-[#f4a006] transition-all"
            style={{ background: '#f7b917' }}
          >
            {cta.label}
          </Link>
        ) : (
          <button
            onClick={cta.onClick}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-blue-900 dark:text-black hover:bg-[#f4a006] transition-all"
            style={{ background: '#f7b917' }}
          >
            {cta.label}
          </button>
        )
      ) : null}
    </div>
  );
};