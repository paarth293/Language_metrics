"use client";

import Image from "next/image";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { chatSendError } from "@repo/ui/chat-send-error";
import { motion } from "framer-motion";
import { MessageCircle, Send, Paperclip, AlertCircle, Loader2, Search, FileText, X, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  THREAD_POLL_MS,
  mergeMessages,
  messagePollDelay,
  newerMessagesUrl,
  olderMessagesUrl,
} from "@/lib/chat-polling";
import { getEntry, mutateResource } from "@repo/ui/resource-cache";
import { useStickyState } from "@repo/ui/useStickyState";

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

/**
 * The chat page keeps its own request bookkeeping — versioned requests,
 * in-flight guards and an idle poll backoff — which is left as it is. What
 * changed is where the first paint comes from: the thread list and each
 * conversation are mirrored into the shared cache, so navigating away and
 * back renders what was on screen instead of a spinner over an empty panel,
 * and a tab resume checks how old the list actually is before refetching.
 */
const THREADS_KEY = "/api/students/chat";
const messagesKey = (id: string) => `/api/students/chat/${id}`;

type ThreadsCache = { threads: ChatThread[] };
type MessagesCache = { messages: ChatMessage[]; hasMore: boolean };

export default function ChatPage() {
  const [threads, setThreads] = useState<ChatThread[]>(
    () => getEntry<ThreadsCache>(THREADS_KEY).data?.threads ?? []
  );
  // The open conversation outlives a navigation, so coming back to chat
  // reopens it rather than dropping to the empty-panel state.
  const [selectedTeacher, setSelectedTeacher] = useStickyState<string | null>("chat:selected", null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  // Only a true first visit has nothing to show.
  const [loading, setLoading] = useState(
    () => getEntry<ThreadsCache>(THREADS_KEY).data === undefined
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  // Why the last send failed, shown above the composer (chat follow-up).
  const [sendError, setSendError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Latest messages for poll URLs, the time of the last activity for the idle
  // backoff, and scroll bookkeeping so loading older messages keeps the view
  // still while new ones scroll to the bottom.
  const messagesRef = useRef<ChatMessage[]>([]);
  const lastActivityRef = useRef(0); // set when a conversation opens
  const preserveScrollHeightRef = useRef<number | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const threadRequest = useRef({ version: 0 });
  const threadInFlight = useRef(false);
  const messageRequest = useRef({ version: 0 });
  const messageInFlight = useRef(false);
  const selectedTeacherRef = useRef<string | null>(null);
  const selectTeacher = (teacherId: string | null) => {
    selectedTeacherRef.current = teacherId;
    messageRequest.current.version++;
    setSelectedTeacher(teacherId);
  };

  const fetchThreads = useCallback(async (showLoading = true) => {
    if (!showLoading && threadInFlight.current) return;
    threadInFlight.current = true;
    const request = ++threadRequest.current.version;
    try {
      if (showLoading) setLoading(true);
      const res = await fetch("/api/students/chat");
      if (!res.ok) throw new Error("Failed to load chats");
      const data = await res.json();
      if (request !== threadRequest.current.version) return;
      setThreads(data.threads || []);
      mutateResource<ThreadsCache>(THREADS_KEY, { threads: data.threads || [] });
      setError(null);
    } catch (err: unknown) {
      if (request === threadRequest.current.version) setError(err instanceof Error ? err.message : "Failed to load chats");
    } finally {
      if (request === threadRequest.current.version) { threadInFlight.current = false; setLoading(false); }
    }
  }, []);

  // The first load (showLoading) fetches the newest page and replaces the
  // list; a poll fetches only newer messages and merges them in by id.
  const fetchMessages = useCallback(async (teacherId: string, showLoading = true) => {
    if (!showLoading && messageInFlight.current) return;
    messageInFlight.current = true;
    const request = ++messageRequest.current.version;
    try {
      if (showLoading) {
        // Reopening a conversation paints the cached messages first; only a
        // conversation never opened in this session shows a loading state.
        const cached = getEntry<MessagesCache>(messagesKey(teacherId)).data;
        setMessages(cached?.messages ?? []);
        messagesRef.current = cached?.messages ?? [];
        setHasOlder(cached?.hasMore ?? false);
        setLoadingMessages(cached === undefined);
      }
      const base = `/api/students/chat/${teacherId}`;
      const current = messagesRef.current;
      const res = await fetch(showLoading ? base : newerMessagesUrl(base, current[current.length - 1]));
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      if (request !== messageRequest.current.version) return;
      const incoming: ChatMessage[] = data.messages || [];
      if (showLoading) {
        setMessages(incoming);
        messagesRef.current = incoming;
        setHasOlder(Boolean(data.hasMore));
        mutateResource<MessagesCache>(messagesKey(teacherId), {
          messages: incoming,
          hasMore: Boolean(data.hasMore),
        });
      } else {
        const merged = mergeMessages(messagesRef.current, incoming);
        if (merged.length !== messagesRef.current.length) {
          lastActivityRef.current = Date.now();
          messagesRef.current = merged;
          setMessages(merged);
          // hasMore belongs to the paging state, not this poll, so carry
          // whatever the cache already recorded for it.
          mutateResource<MessagesCache>(messagesKey(teacherId), {
            messages: merged,
            hasMore: getEntry<MessagesCache>(messagesKey(teacherId)).data?.hasMore ?? false,
          });
        }
      }
    } catch (err: unknown) {
      if (request === messageRequest.current.version) console.error("Failed to load messages:", err);
    } finally {
      if (request === messageRequest.current.version) { messageInFlight.current = false; setLoadingMessages(false); }
    }
  }, []);

  const loadOlderMessages = async () => {
    const teacherId = selectedTeacherRef.current;
    const oldest = messagesRef.current[0];
    if (!teacherId || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(olderMessagesUrl(`/api/students/chat/${teacherId}`, oldest));
      if (!res.ok) throw new Error("Failed to load older messages");
      const data = await res.json();
      if (selectedTeacherRef.current !== teacherId) return;
      preserveScrollHeightRef.current = messagesContainerRef.current?.scrollHeight ?? null;
      const merged = mergeMessages(messagesRef.current, data.messages || []);
      messagesRef.current = merged;
      setMessages(merged);
      setHasOlder(Boolean(data.hasMore));
    } catch (err: unknown) {
      console.error("Failed to load older messages:", err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Thread list: every 30 s while the tab is visible; paused while hidden and
  // refreshed once as soon as it is visible again.
  useEffect(() => {
    const requestState = threadRequest.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      await fetchThreads(false);
      clearTimeout(timer);
      timer = setTimeout(() => void tick(), THREAD_POLL_MS);
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") return;
      // Returning to the tab only refetches a list that is genuinely older
      // than one poll interval; otherwise it just re-arms the timer.
      const age = Date.now() - getEntry(THREADS_KEY).updatedAt;
      if (age >= THREAD_POLL_MS) void tick();
      else timer = setTimeout(() => void tick(), THREAD_POLL_MS - age);
    };
    const initial = setTimeout(() => void fetchThreads(), 0);
    timer = setTimeout(() => void tick(), THREAD_POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(initial);
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      requestState.version++;
    };
  }, [fetchThreads]);

  // Open conversation: every 10 s, 30 s after 2 minutes with no new
  // messages; paused while hidden and polled once as soon as it is visible.
  useEffect(() => {
    if (!selectedTeacher) return;
    const requestState = messageRequest.current;
    lastActivityRef.current = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void tick(), messagePollDelay(lastActivityRef.current));
    };
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      await fetchMessages(selectedTeacher, false);
      schedule();
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "hidden") {
        lastActivityRef.current = Date.now();
        void tick();
      }
    };
    const initial = setTimeout(() => void fetchMessages(selectedTeacher), 0);
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(initial);
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      requestState.version++;
    };
  }, [selectedTeacher, fetchMessages]);

  // Keep the view still when older messages are prepended; scroll to the
  // bottom only when a new message is appended.
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    const previousHeight = preserveScrollHeightRef.current;
    if (container && previousHeight !== null) {
      container.scrollTop += container.scrollHeight - previousHeight;
      preserveScrollHeightRef.current = null;
      return;
    }
    const lastId = messages[messages.length - 1]?.id ?? null;
    if (lastId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastId;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedTeacher || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/students/chat/${selectedTeacher}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });
      if (!res.ok) {
        setSendError(await chatSendError(res));
        return;
      }
      const data = await res.json();
      if (selectedTeacherRef.current === selectedTeacher) {
        messageRequest.current.version++;
        messageInFlight.current = false;
        lastActivityRef.current = Date.now();
        messagesRef.current = mergeMessages(messagesRef.current, [data.message]);
        setMessages(messagesRef.current);
        setNewMessage("");
      }
    } catch {
      setSendError("Message not sent. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedTeacher) return;
    setSendError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("content", file.name);

    try {
      const res = await fetch(`/api/students/chat/${selectedTeacher}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        setSendError(await chatSendError(res));
        return;
      }
      const data = await res.json();
      if (selectedTeacherRef.current === selectedTeacher) {
        messageRequest.current.version++;
        messageInFlight.current = false;
        lastActivityRef.current = Date.now();
        messagesRef.current = mergeMessages(messagesRef.current, [data.message]);
        setMessages(messagesRef.current);
      }
    } catch {
      setSendError("Attachment not sent. Please check your connection and try again.");
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
        <Button onClick={() => void fetchThreads()} variant="outline">
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
                onClick={() => selectTeacher(thread.teacherId)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                  selectedTeacher === thread.teacherId ? "bg-amber-50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    {thread.teacherAvatar ? (
                      <Image unoptimized width={96} height={96}
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
              onClick={() => selectTeacher(null)}
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
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {hasOlder && !loadingMessages && (
              <div className="flex justify-center">
                <button
                  onClick={() => void loadOlderMessages()}
                  disabled={loadingOlder}
                  className="text-xs text-amber-700 hover:underline disabled:opacity-50"
                >
                  {loadingOlder ? "Loading…" : "Load older messages"}
                </button>
              </div>
            )}
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
                        <a
                          href={msg.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 underline hover:no-underline"
                        >
                          <FileText className="w-5 h-5 opacity-70 shrink-0" />
                          <span className="text-sm font-medium break-all">
                            {msg.content || "Attachment"}
                          </span>
                        </a>
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
              {sendError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 mb-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
                >
                  <span className="flex-1">{sendError}</span>
                  <button
                    type="button"
                    onClick={() => setSendError(null)}
                    aria-label="Dismiss"
                    className="text-red-500 hover:text-red-700 font-medium"
                  >
                    ×
                  </button>
                </div>
              )}
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
