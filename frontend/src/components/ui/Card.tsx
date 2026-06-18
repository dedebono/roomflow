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
      className={`glass rounded-xl p-5 shadow-lg border border-slate-200 transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:border-indigo-500/40 hover:shadow-indigo-500/5 hover:-translate-y-0.5' : ''
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
  <h3 className={`text-lg font-bold text-slate-900 tracking-tight ${className}`}>{children}</h3>
);

export const CardDescription = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <p className={`text-xs text-slate-500 mt-1 ${className}`}>{children}</p>
);

export const CardContent = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`mt-4 pt-4 border-t border-slate-200 flex items-center justify-end gap-2 ${className}`}>{children}</div>
);
