"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Video, VideoOff, Mic, MicOff, MessageSquare,
  MonitorUp, Phone, Loader2, AlertCircle, Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type SessionInfo = {
  id: string;
  teacherName: string;
  language: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
};

export default function LiveClassPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/students/classes?filter=upcoming`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load session");
        const data = await res.json();
        const found = data.bookings?.find((b: { id: string }) => b.id === sessionId);
        if (found) {
          setSession({
            id: found.id,
            teacherName: found.teacher,
            language: found.language,
            scheduledStart: found.nextSession?.scheduledStart || "",
            scheduledEnd: found.nextSession?.scheduledEnd || "",
            status: found.status,
          });
        } else {
          setError("Session not found");
        }
      } catch {
        setError("Failed to load session");
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, { sender: "You", text: chatInput, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setChatInput("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <span className="text-sm text-text-muted">Connecting to classroom...</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">Unable to join</h2>
            <p className="text-text-muted mb-6">{error || "Session not found"}</p>
            <Link href="/student/classes" className="inline-flex py-2 px-4 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-all">
              Back to Classes
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] bg-bg">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <Link href="/student/classes" className="text-text-muted hover:text-text transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-sm font-semibold text-text">{session.teacherName}</h2>
            <p className="text-xs text-text-muted">{session.language} · Live Session</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-medium text-red-500">LIVE</span>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 relative bg-[#0f0c29] flex items-center justify-center">
          {/* Teacher Video Placeholder */}
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-white/40">
              <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Waiting for teacher to join...</p>
              <p className="text-xs mt-1 text-white/20">Video will appear here</p>
            </div>
          </div>

          {/* Self Video PiP */}
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-xl bg-surface border border-border overflow-hidden shadow-lg">
            <div className="w-full h-full flex items-center justify-center bg-surface-inset">
              <span className="text-xs text-text-muted">{videoEnabled ? "Your Camera" : "Camera Off"}</span>
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        {chatOpen && (
          <div className="w-80 border-l border-border bg-surface flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text">In-Class Chat</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-8">No messages yet</p>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`text-sm ${msg.sender === "You" ? "text-right" : ""}`}>
                    <span className="text-[10px] text-text-subtle">{msg.sender} · {msg.time}</span>
                    <p className={`mt-0.5 px-3 py-1.5 rounded-lg inline-block max-w-[85%] ${msg.sender === "You" ? "bg-brand/10 text-text" : "bg-surface-inset text-text"}`}>
                      {msg.text}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface-inset text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-brand"
                />
                <button onClick={sendMessage} className="p-2 rounded-lg bg-brand text-white hover:bg-brand-hover transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-4 py-4 border-t border-border bg-surface">
        <button
          onClick={() => setVideoEnabled(!videoEnabled)}
          className={`p-3 rounded-xl transition-all ${videoEnabled ? "bg-surface-inset text-text hover:bg-border" : "bg-red-500/10 text-red-500"}`}
        >
          {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={`p-3 rounded-xl transition-all ${audioEnabled ? "bg-surface-inset text-text hover:bg-border" : "bg-red-500/10 text-red-500"}`}
        >
          {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
        <button className="p-3 rounded-xl bg-surface-inset text-text hover:bg-border transition-all">
          <MonitorUp className="w-5 h-5" />
        </button>
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`p-3 rounded-xl transition-all ${chatOpen ? "bg-brand/10 text-brand" : "bg-surface-inset text-text hover:bg-border"}`}
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          onClick={() => { router.push("/classes"); }}
          className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all ml-4"
        >
          <Phone className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
