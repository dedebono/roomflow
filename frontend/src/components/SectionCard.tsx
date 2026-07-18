'use client';

import React, { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: {
    label: string;
    className?: string;
  };
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const SectionCard = ({
  title,
  description,
  icon,
  badge,
  action,
  children,
  className = '',
  onClick,
  hoverable = true,
}: SectionCardProps) => {
  const isInteractive = !!onClick || hoverable;
  const rootClass = [
    'bg-[#fefefe] dark:bg-[#2a2a2a] rounded-2xl p-5',
    'border border-[#cbe2f0] dark:border-[#3a3a3a]',
    'transition-all duration-200',
    'dark:bg-[#2a2a2a]',
    isInteractive ? 'cursor-pointer hover:border-[#264da1] hover:shadow-md hover:-translate-y-0.5' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      onClick={onClick}
      className={rootClass}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className="rounded-xl p-2.5 flex items-center justify-center bg-[linear-gradient(135deg,#cbe2f0_0%,#e8f0f7_100%)] dark:bg-[linear-gradient(135deg,#1a3a5c_0%,#264da1_100%)]"
            >
              {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
                className: 'w-5 h-5 text-[#143258] dark:text-[#cbe2f0]',
              })}
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-[#143258] dark:text-[#e8e8e8]">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[#474547] dark:text-[#a8a8a8] mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {badge && (
          <span
            className={[
              'text-xs font-semibold px-2.5 py-1 rounded-full shrink-0',
              badge.className ?? 'bg-[#f7b917] text-[#143258] dark:bg-[#1a3a5c] dark:text-white border border-[#f7b917] dark:border-[#264da1]',
            ].join(' ')}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  );
};