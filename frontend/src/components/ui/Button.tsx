import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) => {
  const isDisabled = disabled || isLoading;
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#F59E0B] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] min-h-[44px] touch-target';
  const variants = {
    primary: 'bg-[#143258] hover:bg-[#0F172A] text-white shadow-sm hover:shadow-md focus-visible:ring-[#143258] border border-[#143258]',
    secondary: 'bg-white hover:bg-[#FFFBEB] text-[#0F172A] border-2 border-[#FDE68A] focus-visible:ring-[#F59E0B]',
    danger: 'bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-sm focus-visible:ring-[#DC2626] border border-[#DC2626]',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm focus-visible:ring-emerald-500 border border-emerald-600',
    ghost: 'hover:bg-[#FFFBEB] text-[#57534E] hover:text-[#0F172A] focus-visible:ring-[#F59E0B] border border-transparent',
  };
  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[36px]',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };
  return (
    <button disabled={isDisabled} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {isLoading && (
        <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};
