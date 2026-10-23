import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import type { TxnDraft } from "@/lib/types";
import { CategoryBadge } from "./category-badge";

export function TxnAmount({ t, className = "" }: { t: Pick<TxnDraft, "type" | "amount">; className?: string }) {
  const sign = t.type === "expense" ? "-" : t.type === "income" ? "+" : "";
  const color = t.type === "income" ? "text-income" : t.type === "transfer" ? "text-ink-3" : "text-ink";
  return (
    <span className={`num font-semibold ${color} ${className}`}>
      {sign}
      {formatNumber(t.amount)}원
    </span>
  );
}

export function TxnRow({
  t,
  onClick,
  leading,
  trailingNote,
}: {
  t: TxnDraft;
  onClick?: () => void;
  leading?: ReactNode;
  trailingNote?: ReactNode;
}) {
  const sub = [t.subcategory ?? t.category, t.method, t.time].filter(Boolean).join(" · ");
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-surface-2">
      {leading}
      <CategoryBadge name={t.category} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{t.merchant}</span>
        <span className="block truncate text-[13px] text-ink-3">{sub}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <TxnAmount t={t} className="text-[15px]" />
        {trailingNote}
      </span>
    </button>
  );
}
