'use client';

import React from 'react';

type ActivityType = 'booking' | 'payment' | 'message' | 'system';

interface ActivityBadge {
  label: string;
  type: ActivityType;
}

interface ActivityItemProps {
  title: string;
  description?: string | null;
  time: string;
  badge?: ActivityBadge;
  onClick?: () => void;
  className?: string;
}

const badgeStyles: Record<ActivityType, { bg: string; text: string }> = {
  booking: { bg: 'bg-[#f7b917]/15', text: 'text-[#143258]' },
  payment: { bg: 'bg-[#cbe2f0]', text: 'text-[#143258]' },
  message: { bg: 'bg-[#264da1]/15', text: 'text-[#264da1]' },
  system: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-[#747474] dark:text-[#a8a8a8]' },
};

export const ActivityItem = ({
  title,
  description,
  time,
  badge,
  onClick,
  className = '',
}: ActivityItemProps) => {
  const isInteractive = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`
        flex items-start gap-3 py-3
        border-b border-[#cbe2f0] dark:border-[#3a3a3a]
        last:border-b-0
        ${isInteractive ? 'cursor-pointer hover:bg-[#cbe2f0]/10 dark:hover:bg-[#3a3a3a]/50 transition-colors rounded-lg px-2 -mx-2' : ''}
        ${className}
      `}
    >
      {/* Icon circle */}
      <div
        className="rounded-xl p-2 shrink-0 mt-0.5 bg-[linear-gradient(135deg,#cbe2f0_0%,#e8f0f7_100%)] dark:bg-[linear-gradient(135deg,#1a3a5c_0%,#264da1_100%)]"
      >
        <svg
          className="w-3.5 h-3.5 text-[#143258] dark:text-[#cbe2f0]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-[#474547] dark:text-[#e8e8e8] truncate">
            {title}
          </p>
          {badge && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeStyles[badge.type].bg} ${badgeStyles[badge.type].text}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-[#747474] dark:text-[#a8a8a8] mt-0.5 truncate">
            {description}
          </p>
        )}
        <p className="text-xs text-[#747474] dark:text-[#a8a8a8] mt-1">
          {time}
        </p>
      </div>
    </div>
  );
};