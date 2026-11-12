import type { ReactNode } from "react";
import { formatNumber, splitEmoji } from "@/lib/format";
import { currencyInfo, formatFx } from "@/lib/fx";
import type { RecordDraft } from "@/lib/types";

/** 지출은 −, 수입은 +. 지출 차감(음수 지출: 엔빵·환불)은 +로 초록, 수입 차감은 −로 */
export function Amount({ r, className = "" }: { r: Pick<RecordDraft, "kind" | "amount">; className?: string }) {
  const refund = r.kind === "지출" && r.amount < 0;
  const sign = r.kind === "이동" ? "" : (r.kind === "지출") !== r.amount < 0 ? "−" : "+";
  const color = refund ? "text-[#1a9a5c]" : r.kind === "수입" ? (r.amount < 0 ? "text-danger" : "text-income") : r.kind === "이동" ? "text-ink-3" : "text-ink";
  return (
    <span className={`num font-semibold ${color} ${className}`}>
      {sign}
      {formatNumber(Math.abs(r.amount))}원
    </span>
  );
}

export function accountLabel(r: RecordDraft) {
  if (r.kind === "이동") return [r.outAccount, r.inAccount].filter(Boolean).join(" → ");
  return r.kind === "수입" ? r.inAccount : r.outAccount;
}

/** 지출 차감이면 "돌려받음" 표시 */
export function refundLabel(r: RecordDraft) {
  return r.kind === "지출" && r.amount < 0 ? "돌려받음" : r.kind === "수입" && r.amount < 0 ? "수입 차감" : null;
}

export function RecordRow({ r, onClick, leading, note }: { r: RecordDraft; onClick?: () => void; leading?: ReactNode; note?: ReactNode }) {
  const { emoji, label } = splitEmoji(r.category ?? "");
  const fx = r.fx ? `${currencyInfo(r.fx.currency).flag} ${formatFx(r.fx)}` : null;
  const sub = [fx, refundLabel(r), r.subcategory ?? (r.kind === "이동" ? "이동" : label), accountLabel(r)].filter(Boolean).join(" · ");
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
