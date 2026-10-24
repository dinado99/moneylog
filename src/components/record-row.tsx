import type { ReactNode } from "react";
import { formatNumber, splitEmoji } from "@/lib/format";
import type { RecordDraft } from "@/lib/types";

export function Amount({ r, className = "" }: { r: Pick<RecordDraft, "kind" | "amount">; className?: string }) {
  const sign = r.kind === "지출" ? "-" : r.kind === "수입" ? "+" : "";
  const color = r.kind === "수입" ? "text-income" : r.kind === "이동" ? "text-ink-3" : "text-ink";
  return (
    <span className={`num font-semibold ${color} ${className}`}>
      {sign}
      {formatNumber(r.amount)}원
    </span>
  );
}

export function accountLabel(r: RecordDraft) {
  if (r.kind === "이동") return [r.outAccount, r.inAccount].filter(Boolean).join(" → ");
  return r.kind === "수입" ? r.inAccount : r.outAccount;
}

export function RecordRow({ r, onClick, leading, note }: { r: RecordDraft; onClick?: () => void; leading?: ReactNode; note?: ReactNode }) {
  const { emoji, label } = splitEmoji(r.category ?? "");
  const sub = [r.subcategory ?? (r.kind === "이동" ? "이동" : label), accountLabel(r)].filter(Boolean).join(" · ");
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-surface-2">
      {leading}
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-surface-2 text-[20px]">
        {r.kind === "이동" ? "🔁" : (emoji ?? label.charAt(0))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{r.content || label || "(내용 없음)"}</span>
        <span className="block truncate text-[13px] text-ink-3">{sub}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <Amount r={r} className="text-[15px]" />
        {note}
      </span>
    </button>
  );
}
