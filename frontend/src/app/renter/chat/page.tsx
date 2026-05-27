'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';
import { ChatMessage, Conversation } from '@/types';
import toast from 'react-hot-toast';
import { MessageSquare, Send, User, MessageCircle } from 'lucide-react';
import { useWebSocket } from '@/lib/useWebSocket';

export default function RenterChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { sendMessage } = useWebSocket({
    onNewMessage: (data) => {
      // For renter, userId is the manager's ID
      const managerId = selectedConversation?.userId;
      if (selectedConversation && managerId && data.senderId === managerId) {
        setMessages((prev) => [...prev, data]);
        scrollToBottom();
      }
      fetchConversations();
    },
  });

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data);
    } catch {
      // silently fail
    }
  }, []);

  const fetchMessages = useCallback(async (participantId: string) => {
    try {
      const res = await api.get(`/chat/conversation/${participantId}`);
      setMessages(res.data);
      scrollToBottom();
    } catch {
      toast.error('Failed to load messages');
    }
  }, []);

  const markAsRead = useCallback(async (participantId: string) => {
    try {
      await api.post(`/chat/read/${participantId}`);
      fetchConversations();
    } catch {
      // silently fail
    }
  }, [fetchConversations]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await fetchConversations();
      setIsLoading(false);
    };
    init();
  }, [fetchConversations]);

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    // For renter, conv.userId is the manager's ID
    const managerId = conv.userId;
    await fetchMessages(managerId);
    await markAsRead(managerId);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    setIsSending(true);
    try {
      // For renter, userId is the manager's ID
      const managerId = selectedConversation.userId;
      await api.post('/chat/send', {
        receiverId: managerId,
        content: newMessage.trim(),
      });
      setNewMessage('');
      sendMessage('send_message', {
        receiverId: managerId,
        content: newMessage.trim(),
      });
      await fetchMessages(managerId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-slate-100">Messages</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: 'calc(100vh - 16rem)' }}>
        {/* Conversations List */}
        <Card className="border border-slate-900 glass flex flex-col">
          <CardHeader className="p-4 border-b border-slate-800/40">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/20">
                {conversations.map((conv) => {
                  return (
                    <button
                      key={conv.userId}
                      onClick={() => handleSelectConversation(conv as any)}
                      className={`w-full p-4 text-left hover:bg-slate-800/30 transition-colors ${
                        selectedConversation?.userId === conv.userId ? 'bg-indigo-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-200 truncate">
                              {conv.userName || 'Manager'}
                            </p>
                            <span className="text-xs text-slate-500">
                              {conv.lastMessageAt && formatTime(conv.lastMessageAt)}
                            </span>
                          </div>
                          {conv.lastMessage && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {conv.lastMessage}
                            </p>
                          )}
                        </div>
                        {conv.unreadCount && conv.unreadCount > 0 && (
                          <span className="h-5 min-w-5 px-1.5 flex items-center justify-center bg-indigo-500 text-white text-xs font-bold rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 border border-slate-900 glass flex flex-col">
          {selectedConversation ? (
            <>
              <CardHeader className="p-4 border-b border-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {selectedConversation.userName || 'Manager'}
                    </CardTitle>
                    <CardDescription className="text-xs">Room Manager</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => {
                  // For renter, userId is the manager's ID; isOwn = message from renter (senderId !== managerId)
                  const managerId = selectedConversation.userId;
                  const isOwn = msg.senderId !== managerId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-2xl ${
                          isOwn
                            ? 'bg-indigo-600 text-white rounded-br-md'
                            : 'bg-slate-800 text-slate-200 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isOwn ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </CardContent>

              <div className="p-4 border-t border-slate-800/40">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button
                    variant="primary"
                    onClick={handleSendMessage}
                    isLoading={isSending}
                    disabled={!newMessage.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <p className="text-lg font-semibold">Select a conversation</p>
                <p className="text-sm mt-1">Choose a conversation from the list to start chatting</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
