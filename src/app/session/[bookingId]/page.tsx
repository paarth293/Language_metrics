"use client";

import React, { useState } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare, PhoneOff, Settings, Users, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

// Dummy session data
const sessionData = {
  teacherName: "Elena Rodriguez",
  studentName: "Alex Student",
  language: "Spanish",
  duration: "30 min",
};

export default function LiveSessionPage() {
  const [inCall, setInCall] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  // Lobby State
  if (!inCall) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          
          {/* Video Preview */}
          <div className="relative aspect-video bg-navy rounded-2xl overflow-hidden shadow-lg border border-border">
            {videoOn ? (
              <div className="absolute inset-0 bg-surface-inset flex items-center justify-center text-text-muted">
                (Camera Preview Mock)
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-surface-inset flex items-center justify-center text-text-muted">
                  <VideoOff className="w-8 h-8" />
                </div>
              </div>
            )}
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 p-2 bg-surface/80 backdrop-blur-md rounded-full shadow-sm">
              <button 
                onClick={() => setMicOn(!micOn)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-surface hover:bg-surface-inset text-text' : 'bg-danger text-white'}`}
              >
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => setVideoOn(!videoOn)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${videoOn ? 'bg-surface hover:bg-surface-inset text-text' : 'bg-danger text-white'}`}
              >
                {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Join Info */}
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-bold text-text mb-2">Ready to join?</h1>
              <p className="text-text-muted">1-on-1 {sessionData.language} class with {sessionData.teacherName}</p>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-border flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
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
              <Button onClick={() => setInCall(true)} variant="primary" className="flex-1 bg-accent hover:bg-accent/90 shadow-glow-blue">
                Join Class
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // In-Call State
  return (
    <div className="min-h-screen bg-[#0a0f1c] flex flex-col overflow-hidden text-white">
      {/* Top Bar */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse shadow-[0_0_8px_rgba(220,76,76,0.8)]" />
            <span className="text-sm font-medium tracking-wide">LIVE</span>
          </div>
          <div className="h-4 w-[1px] bg-white/20" />
          <span className="font-semibold">{sessionData.language} Class</span>
        </div>
        <div className="font-mono text-sm tracking-wider bg-white/5 px-3 py-1 rounded-md border border-white/10">
          28:45
        </div>
      </div>

      {/* Main Stage */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        
        {/* Video Grid */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 relative">
          {/* Teacher (Main) */}
          <div className="flex-1 relative bg-navy/50 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            <div className="absolute inset-0 flex items-center justify-center text-white/30">
              (Teacher Video Feed)
            </div>
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium border border-white/10">
              {sessionData.teacherName}
            </div>
          </div>
          
          {/* Student (Self) */}
          <div className="md:w-64 lg:w-80 h-48 md:h-auto relative bg-navy-2/50 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            {videoOn ? (
              <div className="absolute inset-0 flex items-center justify-center text-white/30">
                (Your Video Feed)
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white/50">
                  <VideoOff className="w-6 h-6" />
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium border border-white/10 flex items-center gap-2">
              You {!micOn && <MicOff className="w-3.5 h-3.5 text-danger" />}
            </div>
          </div>
        </div>

        {/* Chat / Side Panel */}
        {chatOpen && (
          <div className="w-80 bg-[#121826] rounded-2xl border border-white/10 flex flex-col shadow-xl">
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
              <span className="font-semibold">Chat</span>
              <button onClick={() => setChatOpen(false)} className="text-white/50 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
              <div className="bg-white/5 rounded-lg p-3 text-sm text-white/80 border border-white/5">
                <div className="font-semibold text-white mb-1">{sessionData.teacherName}</div>
                Hola! Welcome to the class. Let&apos;s start with a quick review of yesterday&apos;s material.
              </div>
            </div>
            <div className="p-4 border-t border-white/10">
              <input type="text" placeholder="Type a message..." className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-gold" />
            </div>
          </div>
        )}
      </div>

      {/* Floating Control Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#1e2638]/90 backdrop-blur-xl p-2.5 rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
        <button 
          onClick={() => setMicOn(!micOn)}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${micOn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-danger text-white'}`}
          title={micOn ? "Mute" : "Unmute"}
        >
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
        <button 
          onClick={() => setVideoOn(!videoOn)}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${videoOn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-danger text-white'}`}
          title={videoOn ? "Stop Video" : "Start Video"}
        >
          {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>
        
        <div className="w-[1px] h-8 bg-white/10 mx-1" />
        
        <button className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors" title="Share Screen">
          <MonitorUp className="w-5 h-5" />
        </button>
        <button onClick={() => setChatOpen(!chatOpen)} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${chatOpen ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Chat">
          <MessageSquare className="w-5 h-5" />
        </button>
        <button className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors" title="Participants">
          <Users className="w-5 h-5" />
        </button>

        <div className="w-[1px] h-8 bg-white/10 mx-1" />

        <button onClick={() => setInCall(false)} className="px-6 h-12 rounded-xl flex items-center justify-center bg-danger hover:bg-danger/90 text-white font-medium transition-colors shadow-[0_0_15px_rgba(220,76,76,0.3)]">
          <PhoneOff className="w-5 h-5 mr-2" /> Leave
        </button>
      </div>
    </div>
  );
}
