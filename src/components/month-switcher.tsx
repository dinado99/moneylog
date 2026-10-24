"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth, shiftMonth } from "@/lib/format";
import { useMonth } from "./app-shell";

export function MonthSwitcher() {
  const { month, setMonth } = useMonth();
  return (
    <div className="flex items-center gap-1">
      <button aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))} className="grid size-9 place-items-center rounded-full text-ink-2 active:bg-surface-2">
        <ChevronLeft size={20} />
      </button>
      <span className="num min-w-16 text-center text-[17px] font-semibold">{formatMonth(month)}</span>
      <button aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))} className="grid size-9 place-items-center rounded-full text-ink-2 active:bg-surface-2">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
