/** Display helpers shared by the portal screens. All take the viewer's locale for clock times. */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export const clock = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function dayOffset(d: Date, now: number) {
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / DAY);
}

/** "Today", "Tomorrow", "Yesterday", "Thu 24 Oct". */
export function dayLabel(d: Date, now: number) {
  const offset = dayOffset(d, now);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" } : {}),
  });
}

/** For mid-sentence use: "today", "tomorrow", "yesterday" or "on Thu 24 Oct". */
export function dayPhrase(d: Date, now: number) {
  const label = dayLabel(d, now);
  return ["Today", "Tomorrow", "Yesterday"].includes(label) ? label.toLowerCase() : `on ${label}`;
}

/** "in 8 min", "in 2 h 5 min", "in 3 days" — or "now" once it has started. */
export function countdown(target: Date, now: number) {
  const ms = target.getTime() - now;
  if (ms <= 0) return "now";
  const mins = Math.ceil(ms / MINUTE);
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** Short relative time for lists: "Just now", "12m", "5h", "Yesterday", "19 Oct". */
export function ago(dateStr: string, now = Date.now()) {
  const d = new Date(dateStr);
  const mins = Math.floor((now - d.getTime()) / MINUTE);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (sameDay(d, new Date(now))) return `${Math.floor(mins / 60)}h ago`;
  if (dayOffset(d, now) === -1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const coins = (n: number) => n.toLocaleString("en-IN");

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
