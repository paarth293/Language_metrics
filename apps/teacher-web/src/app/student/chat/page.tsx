"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Send,
  Paperclip,
  Clock,
  AlertCircle,
  Loader2,
  Search,
  FileText,
  X,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ChatThread {
  teacherId: string;
  teacherName: string;
  teacherAvatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  language: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  attachmentUrl: string | null;
  autoDeleteAt: string;
  createdAt: string;
}

export default function ChatPage() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/students/chat");
      if (!res.ok) throw new Error("Failed to load chats");
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (teacherId: string) => {
    try {
      setLoadingMessages(true);
      const res = await fetch(`/api/students/chat/${teacherId}`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err: unknown) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchThreads();
   
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      fetchMessages(selectedTeacher);
    }
   
  }, [selectedTeacher]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedTeacher || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/students/chat/${selectedTeacher}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setNewMessage("");
    } catch (err: unknown) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedTeacher) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("content", file.name);

    try {
      const res = await fetch(`/api/students/chat/${selectedTeacher}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload file");
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
    } catch (err: unknown) {
      console.error("Upload failed:", err);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getAutoDeleteLabel = (autoDeleteAt: string) => {
    if (!autoDeleteAt) return null;
    const deleteDate = new Date(autoDeleteAt);
    const now = new Date();
    const diffMs = deleteDate.getTime() - now.getTime();
    if (diffMs <= 0) return "Expiring soon";
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `Expires in ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Expires in ${diffDays}d`;
  };

  const filteredThreads = threads.filter(
    (t) =>
      t.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.language.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedThread = threads.find((t) => t.teacherId === selectedTeacher);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-amber-700 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <Button onClick={fetchThreads} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Thread List */}
      <div
        className={`w-80 border-r border-gray-100 flex flex-col ${
          selectedTeacher ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-navy-900">Messages</h2>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search teachers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <MessageCircle className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 text-center">
                No conversations yet. Book a class to start chatting with a
                teacher.
              </p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <button
                key={thread.teacherId}
                onClick={() => setSelectedTeacher(thread.teacherId)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                  selectedTeacher === thread.teacherId ? "bg-amber-50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    {thread.teacherAvatar ? (
                      <img
                        src={thread.teacherAvatar}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-amber-700 font-bold text-sm">
                        {thread.teacherName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-navy-900 truncate">
                        {thread.teacherName}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatTime(thread.lastMessageTime)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {thread.language}
                    </p>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {thread.lastMessage}
                    </p>
                  </div>
                  {thread.unreadCount > 0 && (
                    <span className="w-5 h-5 bg-amber-700 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                      {thread.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedTeacher ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <button
              onClick={() => setSelectedTeacher(null)}
              className="md:hidden p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-amber-700 font-bold text-sm">
                {selectedThread?.teacherName
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
            </div>
            <div>
              <p className="font-semibold text-navy-900 text-sm">
                {selectedThread?.teacherName}
              </p>
              <p className="text-xs text-gray-500">
                {selectedThread?.language}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-amber-700 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <MessageCircle className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">
                  No messages yet. Say hello!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.senderId !== selectedTeacher;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        isOwn
                          ? "bg-amber-700 text-white rounded-br-md"
                          : "bg-gray-100 text-gray-900 rounded-bl-md"
                      }`}
                    >
                      {msg.attachmentUrl ? (
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 opacity-70" />
                          <div>
                            <p className="text-sm font-medium">
                              {msg.attachmentUrl}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                      <div
                        className={`flex items-center gap-2 mt-1 ${
                          isOwn ? "justify-end" : ""
                        }`}
                      >
                        <span
                          className={`text-[10px] ${
                            isOwn ? "text-amber-100" : "text-gray-400"
                          }`}
                        >
                          {formatTime(msg.createdAt)}
                        </span>
                        {msg.autoDeleteAt && (
                          <span
                            className={`text-[10px] flex items-center gap-0.5 ${
                              isOwn ? "text-amber-100" : "text-orange-500"
                            }`}
                          >
                            <Timer className="w-3 h-3" />
                            {getAutoDeleteLabel(msg.autoDeleteAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Paperclip className="w-5 h-5 text-gray-500" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              />
              <Button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="bg-amber-700 hover:bg-amber-800 text-white px-4"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">
              Select a conversation
            </h3>
            <p className="text-gray-500 mt-1 text-sm">
              Choose a teacher from the list to start chatting
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
