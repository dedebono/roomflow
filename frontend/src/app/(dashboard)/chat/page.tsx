'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';
import { ChatMessage, Conversation, User } from '@/types';
import toast from 'react-hot-toast';
import { MessageSquare, Send, User as UserIcon, Clock, MessageCircle } from 'lucide-react';
import { useWebSocket } from '@/lib/useWebSocket';

export default function ManagerChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [renters, setRenters] = useState<User[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket for real-time messaging
  const { sendMessage } = useWebSocket({
    onNewMessage: (data) => {
      const renterId = selectedConversation?.participant2Id || selectedConversation?.userId;
      if (selectedConversation && renterId && data.senderId === renterId) {
        setMessages((prev) => [...prev, data]);
        scrollToBottom();
      }
      // Refresh conversations to update unread counts
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

  // Fetch all renters for starting new conversations
  const fetchRenters = useCallback(async () => {
    try {
      const res = await api.get('/users');
      // Filter only RENTER role users
      const rentersList = res.data.filter((u: User) => u.role === 'RENTER');
      setRenters(rentersList);
    } catch {
      // Silently fail
    }
  }, []);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string, participantId: string) => {
    try {
      const res = await api.get(`/chat/conversation/${participantId}`);
      setMessages(res.data);
      scrollToBottom();
    } catch {
      toast.error('Failed to load messages');
    }
  }, []);

  // Mark messages as read
  const markAsRead = useCallback(async (participantId: string) => {
    try {
      await api.post(`/chat/mark-read/${participantId}`);
      fetchConversations();
    } catch {
      // Silently fail
    }
  }, [fetchConversations]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchConversations(), fetchRenters()]);
      setIsLoading(false);
    };
    init();
  }, [fetchConversations, fetchRenters]);

  // Handle selecting a conversation
  const handleSelectConversation = async (conv: Conversation) => {
    // conv.userId is the renter's ID
    // Call createOrGetConversation to get proper conversation ID for fetching messages
    try {
      const res = await api.post('/chat/conversations', {
        participantId: conv.userId,
      });
      const fullConv = res.data as Conversation;
      setSelectedConversation(fullConv);
      await fetchMessages(fullConv.id!, conv.userId);
      await markAsRead(conv.userId);
    } catch {
      toast.error('Failed to load conversation');
    }
  };

  // Start new conversation with a renter
  const handleStartConversation = async (renterId: string) => {
    const existingConv = conversations.find(
      (c) => c.userId === renterId
    );

    if (existingConv) {
      handleSelectConversation(existingConv);
      return;
    }

    // Create new conversation
    try {
      const res = await api.post('/chat/conversations', {
        participantId: renterId,
      });
      await fetchConversations();
      // Select the new conversation
      const newConv = res.data;
      setSelectedConversation(newConv);
      setMessages([]);
    } catch {
      toast.error('Failed to start conversation');
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setIsSending(true);
    try {
      // participant2Id is the renter's ID (participant1Id is manager/owner)
      const participantId = selectedConversation.participant2Id || selectedConversation.userId;
      await api.post('/chat/send', {
        receiverId: participantId,
        content: newMessage.trim(),
      });
      setNewMessage('');

      // Send via WebSocket for real-time update
      sendMessage('send_message', {
        receiverId: participantId,
        content: newMessage.trim(),
      });

      // Refresh messages (only if we have a proper conversation ID)
      const convId = selectedConversation.id;
      if (convId) {
        await fetchMessages(convId, participantId);
      }
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

  const getRenterName = (conv: Conversation) => {
    return conv.userName || 'Renter';
  };

  return (
    <DashboardLayout
      title="Chat with Renters"
      description="Communicate with room renters about bookings and payments"
      allowedRoles={['ROOM_ADMIN']}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
        {/* Renters List */}
        <Card className="border border-slate-900 glass flex flex-col">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              Renters
            </CardTitle>
            <CardDescription>Start or continue a conversation</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                {/* Renters without active conversation */}
                <div className="p-3 border-b border-slate-800/40">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Start New Chat</p>
                  <div className="space-y-2">
                    {renters.map((renter) => {
                      const hasConv = conversations.some(
                        (c) => c.userId === renter.id
                      );
                      if (hasConv) return null;
                      return (
                        <button
                          key={renter.id}
                          onClick={() => handleStartConversation(renter.id)}
                          className="w-full p-2 rounded-lg text-left hover:bg-slate-800/50 transition-colors flex items-center gap-2"
                        >
                          <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="text-sm text-slate-300 truncate">{renter.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active conversations */}
                <div className="p-3">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Active Chats</p>
                  {conversations.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No active conversations</p>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map((conv) => {
                        return (
                          <button
                            key={conv.userId}
                            onClick={() => handleSelectConversation(conv as any)}
                            className={`w-full p-3 rounded-lg text-left hover:bg-slate-800/30 transition-colors ${
                              selectedConversation?.userId === conv.userId ? 'bg-indigo-500/10' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center">
                                <UserIcon className="w-5 h-5 text-slate-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-semibold text-slate-200 truncate">
                                    {conv.userName || 'Renter'}
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
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 border border-slate-900 glass flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <CardHeader className="p-4 border-b border-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {selectedConversation.participant2?.name || selectedConversation.userName || 'Renter'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {selectedConversation.participant2?.email || selectedConversation.userEmail}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    // participant1Id is manager's ID, participant2Id is renter's ID
                    // A message is "own" if sent by the manager (participant1Id)
                    const isOwn = selectedConversation.participant1Id
                      ? msg.senderId === selectedConversation.participant1Id
                      : msg.senderId !== selectedConversation.userId;
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
                          <p className={`text-xs mt-1 ${
                            isOwn ? 'text-indigo-200' : 'text-slate-400'
                          }`}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Message Input */}
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
                <p className="text-sm mt-1">Choose a renter from the list to start chatting</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
