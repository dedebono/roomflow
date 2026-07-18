import React, { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold text-[#474547] tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`w-full bg-[#fefefe] dark:bg-[#2a2a2a] hover:bg-[#f1dece] dark:hover:bg-[#3a3a3a] focus:bg-[#fefefe] dark:focus:bg-[#2a2a2a] text-[#474547] dark:text-[#e8e8e8] text-sm rounded-lg border appearance-none ${
              error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-[#cbe2f0] dark:border-[#3a3a3a] focus:border-[#264da1] focus:ring-[#264da1]/20'
            } pl-3.5 pr-10 py-2.5 transition-all duration-200 focus:ring-4 outline-none ${className}`}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#fefefe] dark:bg-[#2a2a2a] text-[#474547] dark:text-[#e8e8e8]">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#747474]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && <span className="text-xs text-red-500 font-medium mt-0.5">{error}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';