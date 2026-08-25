"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Plus, Clock, Video } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const times = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

export default function TeacherSchedule() {


  // Dummy helper
  const isBooked = (day: string, time: string) => {
    return (day === "Mon" && time === "14:00") || (day === "Wed" && time === "10:00");
  };

  const isAvailable = (day: string, time: string) => {
    return ["Mon", "Tue", "Wed", "Thu"].includes(day) && ["09:00", "10:00", "14:00", "15:00"].includes(time);
  };

  return (
    <div className="flex flex-col h-full gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand mb-2">My Schedule</h1>
          <p className="text-text-muted">Manage your availability and upcoming classes. Timezone: Local</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> Bulk Edit Availability
          </Button>
          <Button variant="gold" className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Time Off
          </Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col rounded-md border border-border">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-inset">
          <div className="font-semibold text-lg text-brand">August 15 - 21, 2026</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="w-8 h-8"><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm">Today</Button>
            <Button variant="outline" size="icon" className="w-8 h-8"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[800px]">
            {/* Days row */}
            <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-surface z-10">
              <div className="p-4 text-center text-sm font-medium text-text-muted border-r border-border">
                Time
              </div>
              {days.map((day, i) => (
                <div key={day} className="p-4 text-center border-r border-border last:border-r-0">
                  <div className="text-sm font-medium text-text-muted uppercase">{day}</div>
                  <div className="flex items-center justify-center mt-1">
                    <div className={`text-lg font-semibold w-8 h-8 flex items-center justify-center rounded-full ${
                      i === 1 ? 'bg-brand text-brand-on shadow-sm' : 'text-text'
                    }`}>
                      {15 + i}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Time slots */}
            <div className="divide-y divide-border">
              {times.map((time) => (
                <div key={time} className="grid grid-cols-8">
                  <div className="p-3 text-center text-sm text-text-muted border-r border-border bg-surface-inset/30">
                    {time}
                  </div>
                  {days.map((day) => {
                    const booked = isBooked(day, time);
                    const available = isAvailable(day, time) && !booked;

                    return (
                      <div key={`${day}-${time}`} className="border-r border-border p-1 min-h-[80px] last:border-r-0 group hover:bg-surface-inset/50 transition-colors relative cursor-pointer">
                        {booked ? (
                          <div className="absolute inset-1 bg-brand-subtle border border-brand-muted/20 rounded-md p-2 flex flex-col justify-between">
                            <div className="text-xs font-semibold text-brand">Alex S.</div>
                            <div className="flex items-center gap-1 text-xs text-brand-muted"><Video className="w-3 h-3" /> Class</div>
                          </div>
                        ) : available ? (
                          <div className="absolute inset-2 bg-trust-subtle border border-dashed border-trust-muted/30 rounded-md flex items-center justify-center text-trust opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs font-medium">Available</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-4 h-4 text-text-muted" />
                          </div>
                        )}
                        {available && !booked && (
                          <div className="absolute inset-y-0 left-0 w-1 bg-trust-muted/20 group-hover:bg-trust/40 transition-colors" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
