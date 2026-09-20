"use client";

/**
 * Daily LiveKit spend, split by what drives it.
 *
 * Form: stacked bars. The question this answers is "where is the money
 * going", which is a part-to-whole comparison across a discrete time axis —
 * so bars, stacked by cost driver, one bar per day.
 *
 * Palette: categorical slots 1–3 (blue / orange / aqua), validated against
 * BOTH admin surfaces (#ffffff light, #18233c dark) with `--pairs all`:
 * worst CVD ΔE 9.2 light / 9.4 dark, worst normal-vision ΔE 24.0 / 20.9.
 * Aqua sits at 2.82:1 on the light surface, which triggers the relief rule —
 * hence the always-visible legend and the table view below the chart, not a
 * colour-only encoding.
 */

import React, { useId, useMemo, useState } from "react";

export interface DailyCost {
  day: string;
  connectionMinutes: number;
  downstreamGb: number;
  classSessions: number;
  estimatedCostUsd: number;
}

export interface CostChartProps {
  daily: DailyCost[];
  rates: {
    connectionMinuteUsd: number;
    downstreamGbUsd: number;
  };
  egressByDay?: Record<string, number>;
}

const SERIES = [
  { key: "connection", label: "Connection minutes", light: "#2a78d6", dark: "#3987e5" },
  { key: "bandwidth", label: "Bandwidth", light: "#eb6834", dark: "#d95926" },
  { key: "recording", label: "Recording", light: "#1baf7a", dark: "#199e70" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

const usd = (n: number) =>
  n >= 1 ? `$${n.toFixed(2)}` : n > 0 ? `$${n.toFixed(3)}` : "$0";

export default function CostChart({ daily, rates, egressByDay = {} }: CostChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  const rows = useMemo(
    () =>
      daily.map((d) => {
        const connection = d.connectionMinutes * rates.connectionMinuteUsd;
        const bandwidth = d.downstreamGb * rates.downstreamGbUsd;
        const recording = egressByDay[d.day] ?? Math.max(0, d.estimatedCostUsd - connection - bandwidth);
        return {
          day: d.day,
          classSessions: d.classSessions,
          connection,
          bandwidth,
          recording,
          total: connection + bandwidth + recording,
        };
      }),
    [daily, rates, egressByDay]
  );

  const max = Math.max(0.0001, ...rows.map((r) => r.total));

  // Geometry. A 2px gap between stacked segments and between adjacent bars is
  // what keeps a stack readable without borders.
  const H = 180;
  const GAP = 2;
  const barW = rows.length > 0 ? Math.max(4, Math.min(28, 640 / rows.length - GAP)) : 8;
  const W = Math.max(320, rows.length * (barW + GAP));

  if (rows.length === 0) {
    return (
      <div
        className="rounded-lg p-8 text-center text-sm"
        style={{ background: "var(--lm-surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        No LiveKit usage recorded this month yet.
      </div>
    );
  }

  return (
    <figure
      className="viz-root rounded-lg p-5 m-0"
      style={{ background: "var(--lm-surface)", border: "1px solid var(--border)" }}
    >
      <style>{`
        .viz-root { --s1:#2a78d6; --s2:#eb6834; --s3:#1baf7a; --grid: rgba(22,34,63,.10); }
        [data-theme="dark"] .viz-root { --s1:#3987e5; --s2:#d95926; --s3:#199e70; --grid: rgba(248,244,234,.12); }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .viz-root { --s1:#3987e5; --s2:#d95926; --s3:#199e70; --grid: rgba(248,244,234,.12); }
        }
      `}</style>

      <figcaption className="flex flex-wrap items-baseline justify-between gap-3 mb-1">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          Daily LiveKit cost
        </h3>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs underline underline-offset-2"
          style={{ color: "var(--text-muted)" }}
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </figcaption>
      <p className="text-xs mb-4" style={{ color: "var(--text-subtle)" }}>
        Priced at the marginal rate, so a day inside the free allowance still shows what it
        would have cost.
      </p>

      {/* Legend. Always present for 3 series — identity is never colour alone. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-1 mb-4 list-none p-0 m-0">
        {SERIES.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span
              aria-hidden
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: `var(--s${i + 1})` }}
            />
            {s.label}
          </li>
        ))}
      </ul>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="py-2 pr-4 font-semibold" style={{ color: "var(--text-subtle)" }}>Day</th>
                <th className="py-2 pr-4 font-semibold text-right" style={{ color: "var(--text-subtle)" }}>Classes</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="py-2 pr-4 font-semibold text-right" style={{ color: "var(--text-subtle)" }}>
                    {s.label}
                  </th>
                ))}
                <th className="py-2 font-semibold text-right" style={{ color: "var(--text-subtle)" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 pr-4 tabular-nums" style={{ color: "var(--text)" }}>{r.day.slice(5)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{r.classSessions}</td>
                  <td className="py-2 pr-4 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{usd(r.connection)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{usd(r.bandwidth)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{usd(r.recording)}</td>
                  <td className="py-2 text-right tabular-nums font-medium" style={{ color: "var(--text)" }}>{usd(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H + 26}`}
            width="100%"
            height={H + 26}
            role="img"
            aria-label={`Daily LiveKit cost, ${rows.length} days, peak ${usd(max)}`}
            style={{ display: "block" }}
          >
            <defs>
              {/* Rounded data-end: only the top of each stack is rounded. */}
              <clipPath id={`${gradientId}-r`}>
                <rect x="0" y="0" width={W} height={H} />
              </clipPath>
            </defs>

            {/* Recessive gridlines at quarters. */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line
                key={f}
                x1={0}
                x2={W}
                y1={H - f * H}
                y2={H - f * H}
                stroke="var(--grid)"
                strokeWidth={1}
              />
            ))}

            {rows.map((r, i) => {
              const x = i * (barW + GAP);
              let cursor = H;
              const isHover = hover === i;

              return (
                <g
                  key={r.day}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "default" }}
                >
                  {/* Hit target wider than the mark. */}
                  <rect x={x - GAP} y={0} width={barW + GAP * 2} height={H} fill="transparent" />
                  {(["connection", "bandwidth", "recording"] as SeriesKey[]).map((key, si) => {
                    const value = r[key];
                    if (value <= 0) return null;
                    const h = Math.max(1, (value / max) * (H - 8));
                    cursor -= h;
                    const y = cursor;
                    // 2px surface gap below each segment separates the stack.
                    cursor -= GAP;
                    const isTop =
                      (key === "recording" && r.recording > 0) ||
                      (key === "bandwidth" && r.recording <= 0) ||
                      (key === "connection" && r.recording <= 0 && r.bandwidth <= 0);
                    return (
                      <rect
                        key={key}
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        rx={isTop ? Math.min(4, barW / 2) : 0}
                        fill={`var(--s${si + 1})`}
                        opacity={hover === null || isHover ? 1 : 0.45}
                        clipPath={`url(#${gradientId}-r)`}
                      />
                    );
                  })}
                  {/* Day label every 5th bar, so the axis never collides. */}
                  {i % 5 === 0 && (
                    <text
                      x={x + barW / 2}
                      y={H + 16}
                      textAnchor="middle"
                      fontSize={10}
                      fill="var(--text-subtle)"
                    >
                      {r.day.slice(8)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {hover !== null && rows[hover] && (
            <div
              className="absolute top-0 pointer-events-none rounded-lg px-3 py-2 text-xs shadow-lg"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                color: "var(--text)",
                left: `min(calc(100% - 190px), ${hover * (barW + GAP)}px)`,
                minWidth: 170,
              }}
            >
              <p className="font-semibold mb-1">{rows[hover]!.day}</p>
              <p style={{ color: "var(--text-muted)" }}>
                {rows[hover]!.classSessions} classes · {usd(rows[hover]!.total)} total
              </p>
              <ul className="mt-1.5 space-y-0.5 list-none p-0 m-0">
                {SERIES.map((s, i) => (
                  <li key={s.key} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                      <span
                        aria-hidden
                        className="inline-block w-2 h-2 rounded-sm"
                        style={{ background: `var(--s${i + 1})` }}
                      />
                      {s.label}
                    </span>
                    <span className="tabular-nums">
                      {usd(rows[hover]![s.key as SeriesKey])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
