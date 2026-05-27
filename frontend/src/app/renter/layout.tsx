'use client';

import React, { ReactNode, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ChatBubble, ChatPanel } from '@/components/chat/ChatBubble';
import api from '@/lib/api';
import { useWebSocket } from '@/lib/useWebSocket';
import { useAuth } from '@/lib/auth';
import { ChatMessage } from '@/types';

interface RenterLayoutProps {
  children: ReactNode;
}

export default function RenterLayout({ children }: RenterLayoutProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // WebSocket for real-time messaging
  const { sendMessage } = useWebSocket({
    onNewMessage: (data) => {
      if (selectedConversation &&
          (data.senderId === selectedConversation.participant2Id ||
           data.senderId === selectedConversation.participant1Id)) {
        setMessages((prev) => [...prev, data]);
      }
      fetchConversations();
    },
  });

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data);
    } catch {
      // Silently fail
    }
  }, []);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (participantId: string) => {
    try {
      const res = await api.get(`/chat/conversation/${participantId}`);
      setMessages(res.data);
    } catch {
      // Silently fail
    }
  }, []);

  // Mark messages as read
  const markAsRead = useCallback(async (participantId: string) => {
    try {
      await api.post(`/chat/read/${participantId}`);
      fetchConversations();
    } catch {
      // Silently fail
    }
  }, [fetchConversations]);

  // Handle opening chat
  const handleOpenChat = async () => {
    setIsChatOpen(true);
    await fetchConversations();
  };

  // Handle selecting a conversation
  const handleSelectConversation = async (conv: any) => {
    setSelectedConversation(conv);
    const participantId = conv.participant1Id || conv.participant2Id;
    await fetchMessages(participantId);
    await markAsRead(participantId);
  };

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setIsSending(true);
    try {
      const participantId = selectedConversation.participant1Id || selectedConversation.participant2Id;
      await api.post('/chat/send', {
        receiverId: participantId,
        content: newMessage.trim(),
      });
      setNewMessage('');
      sendMessage('send_message', {
        receiverId: participantId,
        content: newMessage.trim(),
      });
      await fetchMessages(participantId);
    } catch {
      // Handle error silently
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Chat Bubble */}
      <ChatBubble onClick={handleOpenChat} />

      {/* Chat Panel */}
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)}>
        {!selectedConversation ? (
          <div className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Conversations</h3>
            {conversations.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No conversations yet</p>
            ) : (
              conversations.map((conv) => {
                const other = conv.participant1?.role === 'RENTER' ? conv.participant2 : conv.participant1;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className="w-full p-3 rounded-lg text-left hover:bg-slate-800/50 transition-colors flex items-center gap-3"
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center">
                      <span className="text-sm font-semibold text-slate-400">
                        {other?.name?.charAt(0) || 'M'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-200 truncate">{other?.name || 'Manager'}</p>
                      {conv.lastMessage && (
                        <p className="text-xs text-slate-500 truncate">{conv.lastMessage.content}</p>
                      )}
                    </div>
                    {conv.unreadCount && conv.unreadCount > 0 && (
                      <span className="h-5 min-w-5 px-1.5 flex items-center justify-center bg-indigo-500 text-white text-xs font-bold rounded-full">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Conversation Header */}
            <div className="p-4 border-b border-slate-800/40 flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ← Back
              </button>
              <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
                <span className="text-xs font-semibold text-slate-400">
                  {(selectedConversation.participant1?.name || selectedConversation.participant2?.name || 'M')?.charAt(0)}
                </span>
              </div>
              <p className="font-semibold text-slate-200">
                {selectedConversation.participant1?.name || selectedConversation.participant2?.name || 'Manager'}
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isOwn = msg.senderId !== (selectedConversation.participant1Id === user?.id
                  ? selectedConversation.participant2Id
                  : selectedConversation.participant1Id);
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                        isOwn
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p className={`text-xs mt-1 ${isOwn ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-slate-800/40 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-700 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </ChatPanel>
    </div>
  );
}
