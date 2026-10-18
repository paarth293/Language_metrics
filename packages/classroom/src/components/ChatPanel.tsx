"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { Send } from "lucide-react";
import type { ChatEntry } from "../types";

const CHAT_TOPIC = "lm-chat";

/**
 * In-class chat over LiveKit's data channel.
 *
 * Data messages ride the existing WebRTC connection, so chat adds no API
 * calls, no database writes and no measurable cost. The previous placeholder
 * pushed messages into local React state, which meant the other person never
 * saw them.
 */
export function ChatPanel({
  selfName,
  open,
  onRead,
  onIncoming,
}: {
  selfName: string;
  open: boolean;
  onRead: () => void;
  onIncoming: () => void;
}) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const { localParticipant } = useLocalParticipant();

  const { send } = useDataChannel(CHAT_TOPIC, (msg) => {
    try {
      const decoded = JSON.parse(new TextDecoder().decode(msg.payload));
      if (!decoded || typeof decoded.text !== "string" || !decoded.text.trim() || decoded.text.length > 1000) return;
      if (!msg.from || msg.from.identity === localParticipant.identity) return;
      const sender = msg.from.name || msg.from.identity;
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          sender,
          text: decoded.text,
          at: Date.now(),
          self: false,
        },
      ]);
      onIncoming();
    } catch {
      // Ignore anything that is not our own message shape.
    }
  });

  useEffect(() => {
    if (open) onRead();
  }, [open, onRead]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, open]);

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const payload = new TextEncoder().encode(JSON.stringify({ text, sender: selfName }));
    // `reliable` so a message is not silently dropped on a lossy link.
    try {
      await send(payload, { reliable: true });
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), sender: selfName, text, at: Date.now(), self: true },
      ]);
      setDraft("");
    } catch {
      setError("Message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }, [draft, selfName, send, sending]);

  return (
    <aside hidden={!open} className={`${open ? "flex" : "hidden"} w-full max-w-xs sm:w-80 border-l border-border bg-surface flex-col shrink-0`}>
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text">In-class chat</h3>
        <p className="text-[11px] text-text-subtle">Messages are not saved after the class.</p>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-8">No messages yet</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.self ? "text-right" : ""}>
              <span className="text-[10px] text-text-subtle">
                {m.sender} ·{" "}
                {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <p
                className={`mt-0.5 px-3 py-1.5 rounded-lg inline-block max-w-[85%] text-sm break-words ${
                  m.self ? "bg-brand/10 text-text" : "bg-surface-inset text-text"
                }`}
              >
                {m.text}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border">
        {error && <p role="alert" className="mb-2 text-xs text-danger">{error}</p>}
        <div className="flex gap-2">
          <input
            value={draft}
            disabled={sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={1000}
            placeholder="Type a message…"
            aria-label="Chat message"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-surface-inset text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending || !draft.trim()}
            aria-label="Send message"
            className="p-2 rounded-lg bg-brand text-white hover:bg-brand-hover transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
