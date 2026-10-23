"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { deleteTxn, saveTxn } from "@/lib/db";
import { formatDayHeader, formatNumber } from "@/lib/format";
import type { Txn, TxnType } from "@/lib/types";
import { useMonth } from "../app-shell";
import { MonthSwitcher } from "../month-switcher";
import { TxnRow } from "../txn-row";
import { TxnSheet } from "../txn-sheet";
import { LoadError, PageHeader, Segmented } from "../ui";
import { useMonthTxns } from "./use-month-txns";

type Filter = "all" | TxnType;

export function HistoryScreen() {
  const { month } = useMonth();
  const { data: txns, error } = useMonthTxns(month);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Txn | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (txns ?? []).filter(
      (t) =>
        (filter === "all" || t.type === filter) &&
        (!q || [t.merchant, t.category, t.subcategory, t.memo, t.method].some((s) => s?.toLowerCase().includes(q))),
    );
    const map = new Map<string, Txn[]>();
    for (const t of list) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()];
  }, [txns, filter, query]);

  if (error) return <LoadError />;
  if (!txns) return null;

  return (
    <>
      <PageHeader title={<MonthSwitcher />} />
      <div className="space-y-3 px-4 pb-3">
        <div className="flex h-11 items-center gap-2 rounded-2xl bg-surface px-4">
          <Search size={18} className="text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="내용, 분류, 메모 검색"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3"
          />
          {query && (
            <button aria-label="지우기" onClick={() => setQuery("")} className="text-ink-3">
              <X size={18} />
            </button>
          )}
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "전체" },
            { value: "expense", label: "지출" },
            { value: "income", label: "수입" },
            { value: "transfer", label: "이체" },
          ]}
        />
      </div>

      {groups.length === 0 ? (
        <p className="py-16 text-center text-[15px] text-ink-3">내역이 없어요</p>
      ) : (
        <div className="space-y-3">
          {groups.map(([date, items]) => {
            const spent = items.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
            return (
              <section key={date} className="mx-4 rounded-3xl bg-surface py-2">
                <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[13px] text-ink-3">
                  <span className="font-medium text-ink-2">{formatDayHeader(date)}</span>
                  {spent > 0 && <span className="num">-{formatNumber(spent)}원</span>}
                </div>
                {items.map((t) => (
                  <TxnRow key={t.id} t={t} onClick={() => setEditing(t)} />
                ))}
              </section>
            );
          })}
        </div>
      )}

      <TxnSheet
        open={editing !== null}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSave={(d) => saveTxn(d, editing ?? undefined)}
        onDelete={editing ? () => deleteTxn(editing.id) : undefined}
      />
    </>
  );
}
