import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, className = '', type = 'text', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold text-[#474547] tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-[#747474] pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={`w-full bg-[#fefefe] dark:bg-[#2a2a2a] hover:bg-[#f1dece] dark:hover:bg-[#3a3a3a] focus:bg-[#fefefe] dark:focus:bg-[#2a2a2a] text-[#474547] dark:text-[#e8e8e8] text-sm rounded-lg border ${
              error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-[#cbe2f0] dark:border-[#3a3a3a] focus:border-[#264da1] focus:ring-[#264da1]/20'
            } ${leftIcon ? 'pl-10' : 'pl-3.5'} pr-3.5 py-2.5 transition-all duration-200 focus:ring-4 outline-none placeholder:text-[#747474] ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-red-500 font-medium mt-0.5">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';