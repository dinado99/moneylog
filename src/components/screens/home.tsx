"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useCategoryLook } from "@/lib/category-look";
import { deleteTxn, saveTxn } from "@/lib/db";
import { currentMonth, daysInMonth, formatNumber, formatWon, todayString } from "@/lib/format";
import type { Txn } from "@/lib/types";
import { useMonth } from "../app-shell";
import { MonthSwitcher } from "../month-switcher";
import { TxnRow } from "../txn-row";
import { TxnSheet } from "../txn-sheet";
import { Card, LoadError, PageHeader } from "../ui";
import { useMonthTxns } from "./use-month-txns";

export function HomeScreen() {
  const { month } = useMonth();
  const { data: txns, error } = useMonthTxns(month);
  const [editing, setEditing] = useState<Txn | "new" | null>(null);
  const look = useCategoryLook();

  const stats = useMemo(() => {
    const list = txns ?? [];
    let expense = 0;
    let income = 0;
    const byCat = new Map<string, number>();
    for (const t of list) {
      if (t.type === "expense") {
        expense += t.amount;
        byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
      } else if (t.type === "income") income += t.amount;
    }
    const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const elapsed = month === currentMonth() ? Number(todayString().slice(8)) : daysInMonth(month);
    return { expense, income, cats, dailyAvg: expense / Math.max(1, elapsed) };
  }, [txns, month]);

  if (error) return <LoadError />;
  if (!txns) return null;
  const recent = txns.slice(0, 5);

  return (
    <>
      <PageHeader title={<MonthSwitcher />} />

      <div className="px-5 pt-2 pb-6">
        <p className="text-[14px] text-ink-3">지출</p>
        <p className="num mt-1 text-[34px] font-bold leading-tight">{formatWon(stats.expense)}</p>
        <div className="mt-3 flex gap-4 text-[14px]">
          <span className="text-ink-3">
            수입 <span className="num font-medium text-income">{formatNumber(stats.income)}</span>
          </span>
          <span className="text-ink-3">
            하루 평균 <span className="num font-medium text-ink-2">{formatNumber(stats.dailyAvg)}</span>
          </span>
        </div>
      </div>

      {stats.cats.length > 0 && (
        <Card className="p-5">
          <h2 className="text-[16px] font-semibold">어디에 썼을까</h2>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            {stats.cats.map(([name, v]) => (
              <span
                key={name}
                style={{ width: `${(v / stats.expense) * 100}%`, background: look("expense", name).color }}
                className="h-full border-r-2 border-surface last:border-r-0"
              />
            ))}
          </div>
          <ul className="mt-4 space-y-3">
            {stats.cats.slice(0, 5).map(([name, v]) => (
              <li key={name} className="flex items-center gap-3 text-[15px]">
                <span className="size-2 rounded-full" style={{ background: look("expense", name).color }} />
                <span className="flex-1">
                  {look("expense", name).emoji} {name}
                </span>
                <span className="num text-[13px] text-ink-3">{Math.round((v / stats.expense) * 100)}%</span>
                <span className="num w-24 text-right font-medium">{formatNumber(v)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-3 py-2">
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <h2 className="text-[16px] font-semibold">최근 내역</h2>
          {txns.length > 0 && (
            <Link href="/history" className="flex items-center text-[13px] text-ink-3">
              전체 <ChevronRight size={16} />
            </Link>
          )}
        </div>
        {recent.length ? (
          recent.map((t) => <TxnRow key={t.id} t={t} onClick={() => setEditing(t)} />)
        ) : (
          <EmptyState />
        )}
      </Card>

      <button
        aria-label="직접 추가"
        onClick={() => setEditing("new")}
        className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-20 grid size-14 place-items-center rounded-full bg-ink text-surface shadow-lg shadow-black/15 active:scale-95"
      >
        <Plus size={26} />
      </button>

      <TxnSheet
        open={editing !== null}
        initial={editing && editing !== "new" ? editing : undefined}
        onClose={() => setEditing(null)}
        onSave={(d) => saveTxn(d, editing && editing !== "new" ? editing : undefined)}
        onDelete={editing && editing !== "new" ? () => deleteTxn(editing.id) : undefined}
      />
    </>
  );
}

function EmptyState() {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-[15px] text-ink-2">아직 내역이 없어요</p>
      <Link
        href="/import"
        className="mt-3 inline-flex h-10 items-center rounded-full bg-accent-soft px-4 text-[14px] font-semibold text-accent"
      >
        뱅크샐러드 내역 가져오기
      </Link>
    </div>
  );
}
