import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card = ({ children, className = '', onClick }: CardProps) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#fefefe] dark:bg-[#2a2a2a] rounded-2xl p-5 shadow-md border border-[#cbe2f0] dark:border-[#3a3a3a] transition-all duration-200 ${
        onClick
          ? 'cursor-pointer hover:border-[#264da1] hover:shadow-lg hover:-translate-y-0.5'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`mb-4 flex items-center justify-between ${className}`}>{children}</div>
);

export const CardTitle = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <h3 className={`text-lg font-bold text-[#143258] dark:text-[#cbe2f0] tracking-tight ${className}`}>{children}</h3>
);

export const CardDescription = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <p className={`text-xs text-[#747474] dark:text-[#a8a8a8] mt-1 ${className}`}>{children}</p>
);

export const CardContent = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`mt-4 pt-4 border-t border-[#cbe2f0] dark:border-[#3a3a3a] flex items-center justify-end gap-2 ${className}`}>{children}</div>
);