"use client";

import React, { useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { Card, CardContent } from "@/components/ui/Card";

interface PracticeChartProps {
  data: Array<{ weekStart: string; hours: number; classes: number }>;
  hoursThisWeek: number;
  hoursLastWeek: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const dateStr = new Date(data.weekStart).toLocaleDateString("en-US", { day: "numeric", month: "short" });
    return (
      <div className="bg-surface shadow-level-1 rounded-[10px] p-[10px] text-sm text-text border border-border dark:border-border-strong">
        <div className="font-semibold mb-1">Week of {dateStr}</div>
        <div className="flex items-center gap-2 text-text-muted">
          <div className="w-1.5 h-1.5 rounded-full bg-brand" />
          {data.hours} hours · {data.classes} classes
        </div>
      </div>
    );
  }
  return null;
};

export function PracticeChart({ data = [], hoursThisWeek, hoursLastWeek }: PracticeChartProps) {
  const [viewAsTable, setViewAsTable] = useState(false);

  const delta = hoursThisWeek - hoursLastWeek;
  const isPositive = delta > 0;
  
  // Calculate how many weeks have data
  const weeksWithData = data.filter(d => d.hours > 0 || d.classes > 0).length;
  const isBrandNew = weeksWithData === 0;
  const isFirstWeek = weeksWithData === 1;

  const firstDate = data.length > 0 ? new Date(data[0].weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : '';
  const lastDate = data.length > 0 ? new Date(data[data.length - 1].weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : '';

  const renderContent = () => {
    if (viewAsTable) {
      return (
        <div className="flex-1 overflow-auto bg-surface-inset/40 rounded-[10px] p-4 text-sm mt-4">
          <table className="w-full text-left">
            <thead>
              <tr className="text-text-subtle border-b border-border">
                <th className="pb-2 font-medium">Week</th>
                <th className="pb-2 font-medium text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-2 text-text">{new Date(row.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="py-2 text-text-muted text-right">{row.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (isBrandNew) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-text-muted text-center max-w-[240px]">
            Your practice hours will appear here after your first class.
          </p>
        </div>
      );
    }

    if (isFirstWeek) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-[40px] font-display font-bold text-text leading-none tracking-[-0.02em] mb-4">
            {hoursThisWeek}
          </div>
          <p className="text-[13px] text-text-muted max-w-[240px]">
            Your first week. Come back next week to see the trend.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="flex-1 mt-4 relative bg-surface-inset/40 rounded-[10px] p-4 pb-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-brand)" stopOpacity={0.14} />
                  <stop offset="95%" stopColor="var(--color-brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="weekStart" hide />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--color-text-subtle)', fontSize: 12 }} 
                tickCount={4} 
              />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ stroke: 'var(--color-border-strong)', strokeWidth: 1, strokeDasharray: "4 4" }} 
              />
              <Area 
                type="monotone" 
                dataKey="hours" 
                stroke="var(--color-brand)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorHours)" 
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)', fill: 'var(--color-brand)' }}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-[12px] text-text-subtle mt-2 px-4">
          <span>{firstDate}</span>
          <span>{lastDate}</span>
        </div>
      </>
    );
  };

  return (
    <Card className="col-span-1 lg:col-span-2 h-[320px] flex flex-col hover:shadow-level-2 transition-shadow duration-180">
      <CardContent className="p-5 sm:p-6 flex-1 flex flex-col relative group">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em]">Practice momentum</h3>
            <p className="text-[13px] text-text-muted mt-0.5">Hours practised, last 8 weeks</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setViewAsTable(!viewAsTable)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-action hover:text-action-hover auth-focus rounded px-1 -mx-1"
            >
              {viewAsTable ? "View chart" : "View table"}
            </button>
            <div className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 ${
              isPositive 
                ? 'bg-trust-subtle text-trust' 
                : 'bg-surface-inset text-text-muted'
            }`}>
              {delta > 0 ? '+' : ''}{delta}h {delta > 0 ? '↑' : (delta < 0 ? '↓' : '')}
            </div>
          </div>
        </div>
        
        {renderContent()}
      </CardContent>
    </Card>
  );
}
