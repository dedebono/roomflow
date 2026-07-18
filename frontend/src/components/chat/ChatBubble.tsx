'use client';

import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useUnreadMessages } from '@/lib/useWebSocket';
import { Button } from '@/components/ui/Button';

interface ChatBubbleProps {
  onClick?: () => void;
}

export const ChatBubble = ({ onClick }: ChatBubbleProps) => {
  const { unreadCount } = useUnreadMessages();

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        onClick={onClick}
        className="relative h-14 w-14 rounded-full bg-gradient-to-r from-[#143258] to-[#264da1] hover:from-[#0f2744] hover:to-[#143258] text-white shadow-lg shadow-[#143258]/30 hover:shadow-[#143258]/50 transition-all duration-200 active:scale-95 flex items-center justify-center"
      >
        <MessageSquare className="w-6 h-6" />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center bg-rose-500 text-white text-xs font-bold rounded-full animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const ChatPanel = ({ isOpen, onClose, children }: ChatPanelProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[32rem] glass border border-slate-200/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/40 bg-white/40">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#264da1] dark:text-[#93c5fd]" />
          <h3 className="font-bold text-slate-900">Messages</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 p-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};
