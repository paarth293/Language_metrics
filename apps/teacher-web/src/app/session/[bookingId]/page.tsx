"use client";

import React, { useState } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare, PhoneOff, Settings, Users, ArrowLeft, Circle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

// Dummy session data
const sessionData = {
  teacherName: "Elena Rodriguez",
  studentName: "Alex Student",
  language: "Spanish",
  duration: "30 min",
};

// Classroom-specific dark palette (NOT the site's light theme)
// Uses the same brand/alert token VALUES but on a dark canvas
const cls = {
  // Canvas layers
  bg:        "bg-neutral-950",          // main classroom background
  surface:   "bg-neutral-900",          // panels / control bar
  elevated:  "bg-neutral-800",          // chat header, tile labels
  border:    "border-neutral-700",      // tile & panel borders
  // Text
  text:      "text-white",
  muted:     "text-neutral-400",
  // Control bar states
  ctrlIdle:  "bg-neutral-800 hover:bg-neutral-700 text-white",
  ctrlOn:    "bg-brand/20 text-brand border border-brand/30",   // active (on) state
  // Semantic
  alert:     "text-alert",              // leave button, recording dot
  brand:     "text-brand",
} as const;

export default function LiveSessionPage() {
  const [inCall, setInCall]     = useState(false);
  const [micOn, setMicOn]       = useState(true);
  const [videoOn, setVideoOn]   = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage]   = useState("");

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  if (!inCall) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

          {/* Video Preview */}
          <div className="relative aspect-video bg-neutral-900 rounded-md overflow-hidden shadow-lg border border-neutral-700">
            {videoOn ? (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm">
                (Camera Preview)
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500">
                  <VideoOff className="w-8 h-8" />
                </div>
              </div>
            )}

            {/* Lobby pre-call controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 p-2 bg-neutral-900/80 backdrop-blur-md rounded-full shadow-sm border border-neutral-700">
              <button
                onClick={() => setMicOn(!micOn)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${micOn ? "bg-neutral-700 hover:bg-neutral-600 text-white" : "bg-alert/20 border border-alert/40 text-alert"}`}
              >
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setVideoOn(!videoOn)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${videoOn ? "bg-neutral-700 hover:bg-neutral-600 text-white" : "bg-alert/20 border border-alert/40 text-alert"}`}
              >
                {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Join Info */}
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-bold text-brand mb-2">Ready to join?</h1>
              <p className="text-text-muted">1-on-1 {sessionData.language} class with {sessionData.teacherName}</p>
            </div>

            <div className="bg-surface p-4 rounded-md border border-border flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-trust animate-pulse" />
              <div>
                <div className="font-medium text-text">Connection is stable</div>
                <div className="text-sm text-text-muted">Test your speakers and microphone</div>
              </div>
              <Button variant="outline" size="icon" className="ml-auto"><Settings className="w-4 h-4" /></Button>
            </div>

            <div className="flex gap-4">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/student/classes"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Link>
              </Button>
              <Button onClick={() => setInCall(true)} variant="gold" className="flex-1">
                Join Class
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── IN-CALL ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${cls.bg} flex flex-col overflow-hidden text-white`}>

      {/* ── Top Bar ── */}
      <div className={`h-16 px-6 flex items-center justify-between border-b border-neutral-800 shrink-0 ${cls.surface}`}>
        <div className="flex items-center gap-4">
          {/* Recording indicator — alert-red is correct here (universal recording convention) */}
          <div className="flex items-center gap-2 bg-alert/10 px-3 py-1.5 rounded-pill border border-alert/20">
            <Circle className="w-2 h-2 fill-alert text-alert animate-pulse" />
            <span className="text-sm font-medium tracking-wide text-alert">REC</span>
          </div>
          <div className="h-4 w-px bg-neutral-700" />
          <span className="font-semibold text-white">{sessionData.language} Class</span>
        </div>
        <div className="font-mono text-sm tracking-wider bg-neutral-800 px-3 py-1 rounded-md border border-neutral-700 text-neutral-300">
          28:45
        </div>
      </div>

      {/* ── Main Stage ── */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">

        {/* Video Grid */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 relative">

          {/* Teacher (Main tile) */}
          <div className={`flex-1 relative bg-neutral-900 rounded-md overflow-hidden ${cls.border} border shadow-lg`}>
            <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm">
              (Teacher Video Feed)
            </div>
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md text-sm font-medium border border-neutral-700/50">
              {sessionData.teacherName}
            </div>
          </div>

          {/* Student (Self tile) */}
          <div className={`md:w-64 lg:w-80 h-48 md:h-auto relative bg-neutral-900 rounded-md overflow-hidden ${cls.border} border shadow-lg`}>
            {videoOn ? (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm">
                (Your Video Feed)
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500">
                  <VideoOff className="w-6 h-6" />
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md text-sm font-medium border border-neutral-700/50 flex items-center gap-2">
              You {!micOn && <MicOff className="w-3.5 h-3.5 text-alert" />}
            </div>
          </div>
        </div>

        {/* ── Chat Panel ── */}
        {chatOpen && (
          <div className="w-80 bg-neutral-900 rounded-md border border-neutral-700 flex flex-col shadow-xl">
            <div className="h-14 flex items-center justify-between px-4 border-b border-neutral-800">
              <span className="font-semibold text-white">In-class Chat</span>
              <button onClick={() => setChatOpen(false)} className="text-neutral-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
              {/* Received message — neutral-800 bubble */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-neutral-400 ml-1">{sessionData.teacherName}</span>
                <div className="bg-neutral-800 rounded-md px-3 py-2 text-sm text-white/90 max-w-[85%]">
                  Hola! Welcome to the class. Let&apos;s start with a quick review.
                </div>
                <span className="text-[10px] text-neutral-500 ml-1">10:02 AM</span>
              </div>

              {/* Own message — brand-indigo tint bubble */}
              <div className="flex flex-col gap-1 items-end">
                <div className="bg-brand/20 border border-brand/25 rounded-md px-3 py-2 text-sm text-white/90 max-w-[85%]">
                  Ready! I reviewed the vocab from last session.
                </div>
                <span className="text-[10px] text-neutral-500 mr-1">10:03 AM</span>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-800">
              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-full px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/30 transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Control Bar ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-900/95 backdrop-blur-xl p-2.5 rounded-md border border-neutral-700 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]">

        {/* Mic — idle=neutral, muted=alert-red tint */}
        <button
          onClick={() => setMicOn(!micOn)}
          className={`w-12 h-12 rounded-md flex items-center justify-center transition-all ${micOn ? cls.ctrlIdle : "bg-alert/15 border border-alert/30 text-alert"}`}
          title={micOn ? "Mute" : "Unmute"}
        >
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera — idle=neutral, off=alert-red tint */}
        <button
          onClick={() => setVideoOn(!videoOn)}
          className={`w-12 h-12 rounded-md flex items-center justify-center transition-all ${videoOn ? cls.ctrlIdle : "bg-alert/15 border border-alert/30 text-alert"}`}
          title={videoOn ? "Stop Video" : "Start Video"}
        >
          {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <div className="w-px h-8 bg-neutral-700 mx-1" />

        {/* Screen Share */}
        <button className={`w-12 h-12 rounded-md flex items-center justify-center transition-all ${cls.ctrlIdle}`} title="Share Screen">
          <MonitorUp className="w-5 h-5" />
        </button>

        {/* Chat — active state uses brand-indigo (NOT gold) */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`w-12 h-12 rounded-md flex items-center justify-center transition-all ${chatOpen ? cls.ctrlOn : cls.ctrlIdle}`}
          title="Chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        {/* Participants */}
        <button className={`w-12 h-12 rounded-md flex items-center justify-center transition-all ${cls.ctrlIdle}`} title="Participants">
          <Users className="w-5 h-5" />
        </button>

        <div className="w-px h-8 bg-neutral-700 mx-1" />

        {/* Leave — alert-coral, deliberate destructive action */}
        <button
          onClick={() => setInCall(false)}
          className="px-5 h-12 rounded-md flex items-center justify-center bg-alert/15 hover:bg-alert/25 border border-alert/30 text-alert font-medium transition-all"
          title="Leave Class"
        >
          <PhoneOff className="w-5 h-5 mr-2" /> Leave
        </button>
      </div>
    </div>
  );
}
