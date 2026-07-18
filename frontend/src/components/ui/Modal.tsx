'use client';

import React, { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#143258]/30 dark:bg-black/60 backdrop-blur-md animate-fade-in"
    >
      <div
        ref={modalRef}
        className={`w-full ${sizes[size]} bg-[#fefefe] dark:bg-[#2a2a2a] border border-[#cbe2f0] dark:border-[#3a3a3a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#cbe2f0] dark:border-[#3a3a3a] bg-[#fefefe] dark:bg-[#2a2a2a]">
          <h2 className="text-lg font-bold text-[#143258] dark:text-[#cbe2f0] tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#747474] hover:text-[#143258] hover:bg-[#cbe2f0] dark:hover:bg-[#3a3a3a] p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 text-sm text-[#474547] dark:text-[#e8e8e8]">
          {children}
        </div>
      </div>
    </div>
  );
};