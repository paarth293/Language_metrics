"use client";

import React from "react";
import Link from "next/link";
import { Video, Star, Users, ArrowUpRight, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

const upcomingClasses = [
  {
    id: "bk_125",
    student: "Alex Student",
    avatar: "https://i.pravatar.cc/150?u=alex",
    level: "Beginner (A1)",
    date: "Today",
    time: "14:00 - 14:30",
    status: "starts_soon",
  },
  {
    id: "bk_127",
    student: "Sarah J.",
    avatar: "https://i.pravatar.cc/150?u=sarah",
    level: "Intermediate (B1)",
    date: "Today",
    time: "16:00 - 17:00",
    status: "confirmed",
  }
];

export default function TeacherDashboard() {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-text">Welcome back, Teacher</h1>
        <p className="text-text-muted">Here&apos;s what&apos;s happening with your classes today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-text-muted mb-2 font-medium">
              <Video className="w-5 h-5 text-accent" /> Next Class
            </div>
            <div className="text-lg font-semibold text-accent">Alex Student</div>
            <div className="text-sm text-text-muted">14:00 - 14:30 (15 min)</div>
            <Button asChild variant="primary" className="mt-4 w-full bg-accent hover:bg-accent/90">
              <Link href="/teacher/schedule">Start Class</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-text-muted mb-2 font-medium">
              <Video className="w-5 h-5 text-accent" /> Classes Taught
            </div>
            <div className="text-3xl font-bold text-text">42</div>
            <div className="text-sm text-text-muted mt-2">12 hours total</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-text-muted mb-2 font-medium">
              <Users className="w-5 h-5 text-success" /> Active Students
            </div>
            <div className="text-3xl font-bold text-text">18</div>
            <div className="text-sm text-success flex items-center gap-1 mt-2">
              <ArrowUpRight className="w-4 h-4" /> +3 new students
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-text-muted mb-2 font-medium">
              <Star className="w-5 h-5 text-gold fill-gold" /> Average Rating
            </div>
            <div className="text-3xl font-bold text-text">4.95</div>
            <div className="text-sm text-text-muted mt-2">Based on 142 reviews</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Schedule */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Today&apos;s Schedule
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/teacher/schedule">View Full Schedule</Link>
          </Button>
        </div>

        <div className="space-y-4">
          {upcomingClasses.map((cls) => (
            <Card key={cls.id} className={`overflow-hidden transition-all ${cls.status === 'starts_soon' ? 'border-accent shadow-md shadow-accent/10' : ''}`}>
              <CardContent className="p-0 sm:flex items-center">
                {/* Left info */}
                <div className="p-6 flex-1 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                  <Avatar src={cls.avatar} size="lg" online={cls.status === 'starts_soon'} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-text">{cls.student}</h3>
                      <Badge variant="success" className="text-[10px] uppercase py-0">{cls.level}</Badge>
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
                      <Button asChild variant="primary" className="w-full bg-accent hover:bg-accent/90 shadow-glow-blue flex gap-2">
                        <Link href={`/session/${cls.id}`}><Video className="w-4 h-4" /> Start Class</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="primary" className="w-full" disabled>
                        Start (Opens 10m before)
                      </Button>
                      <Button variant="outline" size="sm" className="w-full">
                        View Profile & Notes
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
