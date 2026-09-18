import React from "react";

interface StreakDotsProps {
  count: number;
}

export function StreakDots({ count }: StreakDotsProps) {
  if (count <= 0) return null;
  const dots = Math.min(count, 10);
  
  return (
    <div className="flex items-center gap-[6px] mt-2">
      {Array.from({ length: dots }).map((_, i) => (
        <div 
          key={i}
          className="w-2 h-2 rounded-full bg-gradient-to-r from-brand to-brand/60 dark:from-brand/80 dark:to-brand/40"
          style={{ opacity: 1 - (i * 0.05) }}
        />
      ))}
      {count > 10 && <span className="text-[10px] text-text-muted ml-1">+{count - 10}</span>}
    </div>
  );
}
