"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowLeft, Check, FileText, Loader2, MessageCircle, Paperclip, Search, SendHorizontal, Timer, X } from "lucide-react";
import { chatSendError } from "@repo/ui/chat-send-error";
import { useNow } from "@repo/classroom/join-window";
import { getEntry, mutateResource } from "@repo/ui/resource-cache";
import { useStickyState } from "@repo/ui/useStickyState";
import { Button } from "@repo/ui/Button";
import { cn } from "@repo/ui/cn";
import { usePortal } from "../config";
import { THREAD_POLL_MS, mergeMessages, messagePollDelay, newerMessagesUrl, olderMessagesUrl } from "../chat-polling";
import { DAY, clock, dayLabel, sameDay } from "../format";
import { Avatar, EmptyState, ErrorState, ease } from "../primitives";

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
 * The request bookkeeping below — versioned requests, in-flight guards, the
 * idle poll backoff and the cache-first paint — is carried over unchanged
 * from the previous chat page; only what it renders is new.
 */
const THREADS_KEY = "/api/students/chat";
const messagesKey = (id: string) => `/api/students/chat/${id}`;

type ThreadsCache = { threads: ChatThread[] };
type MessagesCache = { messages: ChatMessage[]; hasMore: boolean };

/** Consecutive messages from one sender closer than this read as one block. */
const GROUP_GAP_MS = 5 * 60_000;

export function ChatScreen({ stickyKey = "chat:selected" }: { stickyKey?: string }) {
  const { href, fetch: portalFetch } = usePortal();
  const [threads, setThreads] = useState<ChatThread[]>(() => getEntry<ThreadsCache>(THREADS_KEY).data?.threads ?? []);
  // The open conversation outlives a navigation, so coming back to chat
  // reopens it rather than dropping to the empty-panel state.
  const [selectedTeacher, setSelectedTeacher] = useStickyState<string | null>(stickyKey, null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(() => getEntry<ThreadsCache>(THREADS_KEY).data === undefined);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const messagesRef = useRef<ChatMessage[]>([]);
  const lastActivityRef = useRef(0);
  const preserveScrollHeightRef = useRef<number | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const threadRequest = useRef({ version: 0 });
  const threadInFlight = useRef(false);
  const messageRequest = useRef({ version: 0 });
  const messageInFlight = useRef(false);
  const selectedTeacherRef = useRef<string | null>(selectedTeacher);
  // A conversation restored from sticky state never went through
  // selectTeacher, so mirror it here too; otherwise a just-sent message was
  // not appended until the next poll.
  useEffect(() => {
    selectedTeacherRef.current = selectedTeacher;
  }, [selectedTeacher]);
  const selectTeacher = (teacherId: string | null) => {
    selectedTeacherRef.current = teacherId;
    messageRequest.current.version++;
    setSelectedTeacher(teacherId);
    setSendError(null);
  };

  const fetchThreads = useCallback(async (showLoading = true) => {
    if (!showLoading && threadInFlight.current) return;
    threadInFlight.current = true;
    const request = ++threadRequest.current.version;
    try {
      if (showLoading) setLoading(true);
      const res = await fetch("/api/students/chat", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load chats");
      const data = await res.json();
      if (request !== threadRequest.current.version) return;
      setThreads(data.threads || []);
      mutateResource<ThreadsCache>(THREADS_KEY, { threads: data.threads || [] });
      setError(null);
    } catch (err: unknown) {
      if (request === threadRequest.current.version) setError(err instanceof Error ? err.message : "Failed to load chats");
    } finally {
      if (request === threadRequest.current.version) {
        threadInFlight.current = false;
        setLoading(false);
      }
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
        const cached = getEntry<MessagesCache>(messagesKey(teacherId)).data;
        setMessages(cached?.messages ?? []);
        messagesRef.current = cached?.messages ?? [];
        setHasOlder(cached?.hasMore ?? false);
        setLoadingMessages(cached === undefined);
      }
      const base = `/api/students/chat/${teacherId}`;
      const current = messagesRef.current;
      const res = await fetch(showLoading ? base : newerMessagesUrl(base, current[current.length - 1]), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      if (request !== messageRequest.current.version) return;
      const incoming: ChatMessage[] = data.messages || [];
      if (showLoading) {
        setMessages(incoming);
        messagesRef.current = incoming;
        setHasOlder(Boolean(data.hasMore));
        mutateResource<MessagesCache>(messagesKey(teacherId), { messages: incoming, hasMore: Boolean(data.hasMore) });
      } else {
        const merged = mergeMessages(messagesRef.current, incoming);
        if (merged.length !== messagesRef.current.length) {
          lastActivityRef.current = Date.now();
          messagesRef.current = merged;
          setMessages(merged);
          mutateResource<MessagesCache>(messagesKey(teacherId), {
            messages: merged,
            hasMore: getEntry<MessagesCache>(messagesKey(teacherId)).data?.hasMore ?? false,
          });
        }
      }
    } catch (err: unknown) {
      if (request === messageRequest.current.version) console.error("Failed to load messages:", err);
    } finally {
      if (request === messageRequest.current.version) {
        messageInFlight.current = false;
        setLoadingMessages(false);
      }
    }
  }, []);

  const loadOlderMessages = async () => {
    const teacherId = selectedTeacherRef.current;
    const oldest = messagesRef.current[0];
    if (!teacherId || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(olderMessagesUrl(`/api/students/chat/${teacherId}`, oldest), { credentials: "include" });
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

  // Keep the view still when older messages are prepended; follow new ones
  // only when the reader is already at the bottom (or sent it themselves).
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    const previousHeight = preserveScrollHeightRef.current;
    if (container && previousHeight !== null) {
      container.scrollTop += container.scrollHeight - previousHeight;
      preserveScrollHeightRef.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    const lastId = last?.id ?? null;
    if (lastId !== lastMessageIdRef.current) {
      const firstPaint = lastMessageIdRef.current === null;
      lastMessageIdRef.current = lastId;
      const mine = last && last.senderId !== selectedTeacherRef.current;
      if (firstPaint || mine || !awayFromBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: firstPaint ? "auto" : "smooth", block: "end" });
      }
    }
  }, [messages, awayFromBottom]);

  // A new conversation starts at its newest message.
  useEffect(() => {
    lastMessageIdRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAwayFromBottom(false);
  }, [selectedTeacher]);

  const onScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    setAwayFromBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
  };

  // The composer grows with its text, up to about five lines.
  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [newMessage, selectedTeacher]);

  const appendSent = (teacherId: string, message: ChatMessage) => {
    if (selectedTeacherRef.current !== teacherId) return;
    messageRequest.current.version++;
    messageInFlight.current = false;
    lastActivityRef.current = Date.now();
    messagesRef.current = mergeMessages(messagesRef.current, [message]);
    setMessages(messagesRef.current);
    // The thread list shows this as the latest message straight away.
    setThreads((ts) =>
      ts.map((t) => (t.teacherId === teacherId ? { ...t, lastMessage: message.content, lastMessageTime: message.createdAt } : t))
    );
  };

  const handleSend = async () => {
    const teacherId = selectedTeacher;
    if (!newMessage.trim() || !teacherId || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await portalFetch(`/api/students/chat/${teacherId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: newMessage }),
      });
      if (!res.ok) {
        setSendError(await chatSendError(res));
        return;
      }
      const data = await res.json();
      appendSent(teacherId, data.message);
      if (selectedTeacherRef.current === teacherId) setNewMessage("");
    } catch {
      setSendError("Message not sent. Please check your connection and try again.");
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  };

  const handleFileUpload = async (file: File) => {
    const teacherId = selectedTeacher;
    if (!teacherId) return;
    setSendError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("content", file.name);
    try {
      const res = await portalFetch(`/api/students/chat/${teacherId}`, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) {
        setSendError(await chatSendError(res));
        return;
      }
      const data = await res.json();
      appendSent(teacherId, data.message);
    } catch {
      setSendError("Attachment not sent. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const filteredThreads = threads.filter(
    (t) => t.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) || t.language.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedThread = threads.find((t) => t.teacherId === selectedTeacher);

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-8.5rem)] min-h-[440px] overflow-hidden rounded-xl border border-border bg-surface">
        <div className="w-full space-y-3 border-r border-border p-4 md:w-[340px]">
          <div className="h-10 animate-pulse rounded-full bg-surface-inset" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="h-11 w-11 animate-pulse rounded-full bg-surface-inset" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-inset" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-surface-inset" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden flex-1 bg-surface-inset/40 md:block" />
      </div>
    );
  }

  if (error && threads.length === 0) return <ErrorState title="We couldn't load your chats" onRetry={() => void fetchThreads()} />;

  if (threads.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-8.5rem)] min-h-[440px] items-center justify-center rounded-xl border border-border bg-surface">
        <EmptyState
          icon={MessageCircle}
          title="No conversations yet"
          body="Chat opens with a teacher once you've booked a class with them. Everything stays on Language Metrics."
          action={
            <Button asChild variant="gold">
              <Link href={href("/discover")}>Find a teacher</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100dvh-8.5rem)] min-h-[440px] overflow-hidden rounded-xl border border-border bg-surface shadow-level-1">
      {/* ── Thread list ─────────────────────────────── */}
      <aside className={cn("flex w-full flex-col border-r border-border md:w-[340px] md:shrink-0", selectedTeacher && "hidden md:flex")}>
        <div className="space-y-3 px-4 pb-3 pt-4">
          <h1 className="text-[18px] font-extrabold tracking-[-0.02em] text-text">Chats</h1>
          <label className="relative block">
            <span className="sr-only">Search chats</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teachers or languages"
              className="h-10 w-full rounded-full border border-transparent bg-surface-inset pl-10 pr-4 text-[13px] text-text outline-none transition-colors placeholder:text-text-subtle focus:border-border-strong focus:bg-surface"
            />
          </label>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-2">
          {filteredThreads.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-text-muted">No chats match “{searchQuery}”.</li>}
          {filteredThreads.map((thread) => {
            const active = selectedTeacher === thread.teacherId;
            const unread = thread.unreadCount > 0 && !active;
            return (
              <li key={thread.teacherId}>
                <button
                  type="button"
                  onClick={() => selectTeacher(thread.teacherId)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-ring",
                    active ? "bg-brand/8 dark:bg-surface-2" : "hover:bg-surface-inset/70"
                  )}
                >
                  <Avatar name={thread.teacherName} src={thread.teacherAvatar} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-bold text-text">{thread.teacherName}</span>
                      <span className={cn("shrink-0 text-[11px] tabular-nums", unread ? "font-bold text-trust" : "text-text-subtle")}>
                        {threadTime(thread.lastMessageTime)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn("truncate text-[13px]", unread ? "font-semibold text-text" : "text-text-muted")}>
                        {thread.lastMessage || `${thread.language} teacher`}
                      </span>
                      {unread && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-trust px-1.5 text-[11px] font-bold text-trust-on dark:text-[#0a3d34]">
                          {thread.unreadCount}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Conversation ────────────────────────────── */}
      <AnimatePresence mode="popLayout" initial={false}>
        {selectedTeacher && selectedThread ? (
          <motion.section
            key={selectedTeacher}
            aria-label={`Conversation with ${selectedThread.teacherName}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.24, ease }}
            className="flex min-w-0 flex-1 flex-col"
          >
            <header className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2.5 sm:px-4">
              <button
                type="button"
                onClick={() => selectTeacher(null)}
                className="rounded-full p-2 text-text-muted hover:bg-surface-inset hover:text-text md:hidden focus-ring"
                aria-label="Back to chats"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar name={selectedThread.teacherName} src={selectedThread.teacherAvatar} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-text">{selectedThread.teacherName}</p>
                <p className="truncate text-[12px] text-text-subtle">{selectedThread.language} teacher</p>
              </div>
            </header>

            <div className="relative flex-1 overflow-hidden">
              <div
                ref={messagesContainerRef}
                onScroll={onScroll}
                className="h-full overflow-y-auto px-3 py-4 sm:px-6"
                style={{
                  backgroundColor: "var(--color-bg-subtle)",
                  backgroundImage: "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-text) 7%, transparent) 1px, transparent 0)",
                  backgroundSize: "20px 20px",
                }}
              >
                <div className="mx-auto flex max-w-3xl flex-col">
                  <RetentionNote messages={messages} />
                  {hasOlder && (
                    <div className="mb-3 flex justify-center">
                      <button
                        type="button"
                        onClick={() => void loadOlderMessages()}
                        disabled={loadingOlder}
                        className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-text-muted shadow-sm hover:text-text disabled:opacity-60 focus-ring"
                      >
                        {loadingOlder ? "Loading…" : "Load older messages"}
                      </button>
                    </div>
                  )}

                  {loadingMessages ? (
                    <div className="flex justify-center py-16">
                      <Loader2 className="h-6 w-6 animate-spin text-text-subtle" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="mx-auto mt-10 max-w-xs rounded-2xl bg-surface px-5 py-4 text-center shadow-sm">
                      <p className="text-[14px] font-semibold text-text">Say hello 👋</p>
                      <p className="mt-1 text-[12px] text-text-muted">Share what you want to work on, or send notes before your class.</p>
                    </div>
                  ) : (
                    <MessageList messages={messages} teacherId={selectedTeacher} />
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <AnimatePresence>
                {awayFromBottom && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
                    className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-muted shadow-md hover:text-text focus-ring"
                    aria-label="Jump to latest message"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-border bg-surface px-3 py-3 sm:px-4">
              {sendError && (
                <div role="alert" className="mx-auto mb-2 flex max-w-3xl items-start gap-2 rounded-lg border border-alert/25 bg-alert-subtle px-3 py-2 text-[13px] text-alert-hover">
                  <span className="flex-1">{sendError}</span>
                  <button type="button" onClick={() => setSendError(null)} aria-label="Dismiss" className="rounded p-0.5 opacity-70 hover:opacity-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <form
                className="mx-auto flex max-w-3xl items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                <div className="flex min-h-11 flex-1 items-end rounded-3xl border border-border bg-surface-inset pl-1.5 pr-3 transition-colors focus-within:border-border-strong focus-within:bg-surface">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="mb-1 rounded-full p-2 text-text-subtle transition-colors hover:bg-surface-inset hover:text-text disabled:opacity-50 focus-ring"
                    aria-label="Attach a file"
                  >
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                  </button>
                  <label className="flex-1">
                    <span className="sr-only">Message {selectedThread.teacherName}</span>
                    <textarea
                      ref={composerRef}
                      rows={1}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        // Enter sends; Shift+Enter (or an IME composing) adds a line.
                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder="Type a message"
                      className="block max-h-[132px] w-full resize-none bg-transparent py-[11px] text-[14px] leading-[22px] text-text outline-none placeholder:text-text-subtle"
                    />
                  </label>
                </div>
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.92 }}
                  disabled={!newMessage.trim() || sending}
                  aria-label="Send message"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-on shadow-sm transition-opacity disabled:opacity-40 dark:text-navy focus-ring"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
                </motion.button>
              </form>
            </div>
          </motion.section>
        ) : (
          <motion.div
            key="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="hidden flex-1 flex-col items-center justify-center bg-surface-inset/40 text-center md:flex"
          >
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
              <MessageCircle className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <p className="text-[16px] font-bold text-text">Pick a conversation</p>
            <p className="mt-1 max-w-xs text-[13px] text-text-muted">Message your teachers about homework, notes or class times.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Messages ───────────────────────────────────────────────────────────── */

function threadTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = Date.now();
  if (sameDay(d, new Date(now))) return clock(d);
  if (now - d.getTime() < 7 * DAY) return dayLabel(d, now) === "Yesterday" ? "Yesterday" : d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function MessageList({ messages, teacherId }: { messages: ChatMessage[]; teacherId: string }) {
  // Re-renders each minute so "Today" and the expiry timers roll over on their own.
  const now = useNow(60_000);
  return (
    // initial={false}: the messages already there when a conversation opens
    // stay put; only ones that arrive afterwards animate in.
    <AnimatePresence initial={false}>
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const created = new Date(msg.createdAt);
        const newDay = !prev || !sameDay(new Date(prev.createdAt), created);
        const isOwn = msg.senderId !== teacherId;
        const startsGroup = newDay || !prev || prev.senderId !== msg.senderId || created.getTime() - Date.parse(prev.createdAt) > GROUP_GAP_MS;
        const endsGroup = !next || next.senderId !== msg.senderId || Date.parse(next.createdAt) - created.getTime() > GROUP_GAP_MS || !sameDay(new Date(next.createdAt), created);
        const expiresSoon = msg.autoDeleteAt && Date.parse(msg.autoDeleteAt) - now < 3 * DAY;
        return (
          <React.Fragment key={msg.id}>
            {newDay && (
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-surface/90 px-3 py-1 text-[11px] font-semibold text-text-muted shadow-sm backdrop-blur-sm">
                  {dayLabel(created, now)}
                </span>
              </div>
            )}
            <motion.div
              layout="position"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease }}
              className={cn("flex", isOwn ? "justify-end" : "justify-start", startsGroup ? "mt-2.5" : "mt-0.5")}
            >
              <div
                className={cn(
                  "relative max-w-[80%] px-3 pb-1.5 pt-2 text-[14px] leading-[1.45] shadow-[0_1px_1px_rgba(15,12,41,.06)] sm:max-w-[68%]",
                  isOwn ? "bg-brand-subtle text-text dark:bg-[#2b2a6b]" : "border border-border/70 bg-surface text-text",
                  "rounded-2xl",
                  startsGroup && (isOwn ? "rounded-tr-md" : "rounded-tl-md"),
                  !endsGroup && (isOwn ? "rounded-br-md" : "rounded-bl-md")
                )}
              >
                {msg.attachmentUrl ? (
                  <a
                    href={msg.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-1 flex min-w-[200px] items-center gap-3 rounded-xl bg-surface-inset/80 p-2.5 pr-4 transition-colors hover:bg-surface-inset"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-alert/12 text-alert">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">{msg.content}</span>
                      <span className="text-[11px] text-text-subtle">Tap to open</span>
                    </span>
                  </a>
                ) : (
                  <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                )}
                {/* Floated so short messages keep the time on the same line. */}
                <span className="float-right ml-3 mt-1.5 flex translate-y-0.5 items-center gap-1 text-[10.5px] tabular-nums text-text-subtle">
                  {expiresSoon && <Timer className="h-3 w-3 text-action" aria-label="Expires soon" />}
                  {clock(created)}
                  {isOwn && <Check className="h-3.5 w-3.5" aria-label="Sent" />}
                </span>
              </div>
            </motion.div>
          </React.Fragment>
        );
      })}
    </AnimatePresence>
  );
}

/** "Messages disappear 30 days after they're sent", from the newest message's own expiry. */
function RetentionNote({ messages }: { messages: ChatMessage[] }) {
  const last = messages[messages.length - 1];
  if (!last?.autoDeleteAt) return null;
  const days = Math.round((Date.parse(last.autoDeleteAt) - Date.parse(last.createdAt)) / DAY);
  if (!Number.isFinite(days) || days <= 0 || days > 365) return null;
  return (
    <div className="mb-3 flex justify-center">
      <p className="flex max-w-sm items-center gap-1.5 rounded-lg bg-action-subtle px-3 py-1.5 text-center text-[11.5px] text-text-muted">
        <Timer className="h-3.5 w-3.5 shrink-0 text-gold-strong" />
        Messages disappear {days} days after they&apos;re sent. Save anything you want to keep.
      </p>
    </div>
  );
}

