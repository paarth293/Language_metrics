"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Video, CalendarX2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

const upcomingClasses = [
  {
    id: "bk_125",
    teacher: "Elena Rodriguez",
    avatar: "https://i.pravatar.cc/150?u=elena",
    language: "Spanish",
    date: "Today",
    time: "14:00 - 14:30",
    status: "starts_soon",
  },
  {
    id: "bk_126",
    teacher: "Kenji Sato",
    avatar: "https://i.pravatar.cc/150?u=kenji",
    language: "Japanese",
    date: "Tomorrow",
    time: "09:00 - 10:00",
    status: "confirmed",
  }
];

export default function MyClassesPage() {
  const [activeTab, setActiveTab] = useState("upcoming");

  return (
    <div className="flex flex-col h-full gap-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-text mb-2">My Classes</h1>
          <p className="text-text-muted">Learning Spanish (Beginner) • <span className="text-gold font-medium">3 Day Streak! 🔥</span></p>
        </div>
        <Button asChild variant="gold">
          <Link href="/student/discover">Book a new class</Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {["upcoming", "past", "cancelled"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${
              activeTab === tab ? "text-gold" : "text-text-muted hover:text-text"
            }`}
          >
            <span className="capitalize">{tab}</span>
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gold rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1">
        {activeTab === "upcoming" && (
          <div className="space-y-4">
            {upcomingClasses.map((cls) => (
              <Card key={cls.id} className={`overflow-hidden transition-all ${cls.status === 'starts_soon' ? 'border-accent shadow-md shadow-accent/10' : ''}`}>
                <CardContent className="p-0 sm:flex items-center">
                  {/* Left info */}
                  <div className="p-6 flex-1 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                    <Avatar src={cls.avatar} size="lg" online={cls.status === 'starts_soon'} />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-text">{cls.teacher}</h3>
                        <Badge variant="default" className="text-[10px] uppercase py-0">{cls.language}</Badge>
                      </div>
                      <div className="text-text-muted flex items-center gap-2">
                        <span className="font-medium text-text">{cls.date}</span> • {cls.time} (Local)
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className={`p-6 sm:border-l border-border flex flex-col gap-3 min-w-[200px] ${
                    cls.status === 'starts_soon' ? 'bg-accent/5' : 'bg-surface-inset/30'
                  }`}>
                    {cls.status === 'starts_soon' ? (
                      <>
                        <div className="text-xs font-semibold text-accent uppercase tracking-wider text-center animate-pulse">
                          Starts in 10 min
                        </div>
                        <Button variant="primary" className="w-full bg-accent hover:bg-accent/90 shadow-glow-blue flex gap-2">
                          <Video className="w-4 h-4" /> Join Class
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="primary" className="w-full" disabled>
                          Join (Opens 10m before)
                        </Button>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1 text-text-muted px-0">
                            <RefreshCcw className="w-4 h-4 mr-1" /> Reschedule
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 text-danger hover:text-danger hover:border-danger hover:bg-danger/10 px-0">
                            <CalendarX2 className="w-4 h-4 mr-1" /> Cancel
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab !== "upcoming" && (
          <div className="py-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-surface-inset flex items-center justify-center text-text-muted mb-4">
              <CalendarX2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-text mb-2">No {activeTab} classes</h3>
            <p className="text-text-muted">You don&apos;t have any {activeTab} classes yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
