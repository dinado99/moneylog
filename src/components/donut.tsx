"use client";

import type { Slice } from "@/lib/chart";
import { formatNumber, splitEmoji } from "@/lib/format";

const R = 80;
const W = 26;
const C = 2 * Math.PI * R;

/** 도넛 차트. 조각을 누르면 가운데에 이름·금액·비율이 나온다. */
export function Donut({
  data,
  total,
  label,
  selected,
  onSelect,
}: {
  data: Slice[];
  total: number;
  label: string;
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  const starts = data.map((_, i) => data.slice(0, i).reduce((n, d) => n + d.pct * C, 0));
  const active = data.find((d) => d.name === selected);
  return (
    <div className="relative mx-auto aspect-square w-52">
      <svg viewBox="0 0 200 200" className="size-full -rotate-90" role="img" aria-label={`${label} 분류별 비중`}>
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface-2)" strokeWidth={W} />
        {data.map((d, i) => (
          <circle
            key={d.name}
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={d.color}
            strokeWidth={selected && selected !== d.name ? W - 6 : W}
            strokeDasharray={`${Math.max(d.pct * C - (data.length > 1 ? 2 : 0), 0.1)} ${C}`}
            strokeDashoffset={-starts[i]}
            opacity={selected && selected !== d.name ? 0.35 : 1}
            className="cursor-pointer transition-all"
            onClick={() => onSelect(selected === d.name ? null : d.name)}
          >
            <title>{`${d.name} ${Math.round(d.pct * 1000) / 10}% · ${formatNumber(d.value)}원`}</title>
          </circle>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="max-w-28 truncate text-[13px] text-ink-3">{active ? splitEmoji(active.name).label : label}</span>
        <span className="num text-[18px] font-bold">{formatNumber(active ? active.value : total)}원</span>
        {active && <span className="num text-[13px] text-ink-3">{Math.round(active.pct * 1000) / 10}%</span>}
      </div>
    </div>
  );
}
