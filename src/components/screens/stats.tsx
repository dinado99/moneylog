"use client";

import { useMemo, useState } from "react";
import { ArrowDownWideNarrow, ChevronDown } from "lucide-react";
import { slices } from "@/lib/chart";
import { useCategoryLook } from "@/lib/category-look";
import { formatNumber } from "@/lib/format";
import { useSettings } from "@/lib/settings-db";
import type { Txn } from "@/lib/types";
import { useMonth } from "../app-shell";
import { Donut } from "../donut";
import { MonthSwitcher } from "../month-switcher";
import { TxnRow } from "../txn-row";
import { Card, LoadError, PageHeader, Segmented } from "../ui";
import { useMonthTxns } from "./use-month-txns";

type Kind = "expense" | "income";
type View = "category" | "merchant";
type Sort = "amount" | "count";

export function StatsScreen() {
  const { month } = useMonth();
  const { data: txns, error } = useMonthTxns(month);
  const { data: settings } = useSettings();
  const look = useCategoryLook();
  const [kind, setKind] = useState<Kind>("expense");
  const [view, setView] = useState<View>("category");
  const [sort, setSort] = useState<Sort>("amount");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const totals = useMemo(() => {
    const t = { expense: 0, income: 0 };
    for (const x of txns ?? []) if (x.type !== "transfer") t[x.type] += x.amount;
    return t;
  }, [txns]);

  const list = useMemo(() => (txns ?? []).filter((t) => t.type === kind), [txns, kind]);

  const byCategory = useMemo(() => {
    const map = new Map<string, Txn[]>();
    for (const t of list) map.set(t.category, [...(map.get(t.category) ?? []), t]);
    const order = (settings?.categories ?? []).filter((c) => c.type === kind && !c.parent_id).map((c) => c.name);
    const data = slices(
      [...map.entries()].map(([name, ts]) => [name, ts.reduce((n, t) => n + t.amount, 0)]),
      order,
    );
    return { map, data };
  }, [list, settings, kind]);

  const byMerchant = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const t of list) {
      const m = map.get(t.merchant) ?? { count: 0, amount: 0 };
      m.count++;
      m.amount += t.amount;
      map.set(t.merchant, m);
    }
    return [...map.entries()].sort((a, b) =>
      sort === "amount" ? b[1].amount - a[1].amount || b[1].count - a[1].count : b[1].count - a[1].count || b[1].amount - a[1].amount,
    );
  }, [list, sort]);

  if (error) return <LoadError />;
  if (!txns) return null;
  const total = totals[kind];

  return (
    <>
      <PageHeader title={<MonthSwitcher />} />
      <div className="space-y-3 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {(["income", "expense"] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setSelected(null);
                setOpen(null);
              }}
              className={`rounded-2xl px-4 py-3 text-left transition ${kind === k ? "bg-surface shadow-sm" : "bg-transparent"}`}
            >
              <span className={`block text-[13px] ${kind === k ? "text-ink-2" : "text-ink-3"}`}>{k === "income" ? "수입" : "지출"}</span>
              <span className={`num block text-[18px] font-bold ${kind === k ? (k === "income" ? "text-income" : "text-ink") : "text-ink-3"}`}>
                {formatNumber(totals[k])}원
              </span>
            </button>
          ))}
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "category", label: "분류별" },
            { value: "merchant", label: "내용별" },
          ]}
        />
      </div>

      {!list.length ? (
        <p className="py-16 text-center text-[15px] text-ink-3">{kind === "income" ? "수입" : "지출"} 내역이 없어요</p>
      ) : view === "category" ? (
        <>
          <Card className="py-6">
            <Donut
              data={byCategory.data}
              total={total}
              label={kind === "income" ? "수입" : "지출"}
              selected={selected}
              onSelect={setSelected}
            />
          </Card>
          <Card className="mt-3 overflow-hidden">
            {byCategory.data.map((d, i) => {
              const names = d.others ?? [d.name];
              const items = names.flatMap((n) => byCategory.map.get(n) ?? []);
              const expanded = open === d.name;
              return (
                <div key={d.name} className={i ? "border-t border-line" : ""}>
                  <button
                    onClick={() => {
                      setOpen(expanded ? null : d.name);
                      setSelected(d.name);
                    }}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-surface-2"
                  >
                    <span
                      className="num w-12 shrink-0 rounded-lg py-1 text-center text-[12px] font-semibold text-white"
                      style={{ background: d.color }}
                    >
                      {Math.round(d.pct * 100)}%
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">
                      {!d.others && look(kind, d.name).emoji} {d.name}
                      <span className="ml-1 text-[13px] text-ink-3">{items.length}건</span>
                    </span>
                    <span className="num shrink-0 text-[15px] font-medium">{formatNumber(d.value)}원</span>
                    <ChevronDown size={16} className={`shrink-0 text-ink-3 transition ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && <Breakdown items={items} folded={!!d.others} />}
                </div>
              );
            })}
          </Card>
        </>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 text-[13px] text-ink-3">
            <span>내용</span>
            <button onClick={() => setSort(sort === "amount" ? "count" : "amount")} className="flex items-center gap-1 font-medium text-accent">
              <ArrowDownWideNarrow size={15} />
              {sort === "amount" ? "금액순" : "건수순"}
            </button>
          </div>
          {byMerchant.map(([name, m]) => (
            <div key={name} className="flex items-center gap-3 border-t border-line px-5 py-3.5">
              <span className="min-w-0 flex-1 truncate text-[15px]">{name}</span>
              <span className="num shrink-0 text-[13px] text-ink-3">{m.count}건</span>
              <span className="num w-28 shrink-0 text-right text-[15px] font-medium">{formatNumber(m.amount)}원</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/** 분류를 펼치면 소분류별 합계와 해당 내역을 보여준다. */
function Breakdown({ items, folded }: { items: Txn[]; folded: boolean }) {
  const subs = new Map<string, number>();
  for (const t of items) {
    const key = folded ? t.category : (t.subcategory ?? "소분류 없음");
    subs.set(key, (subs.get(key) ?? 0) + t.amount);
  }
  const total = items.reduce((n, t) => n + t.amount, 0);
  return (
    <div className="bg-surface-2/60 pb-2">
      <div className="space-y-2 px-5 pt-3 pb-2">
        {[...subs.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, v]) => (
            <div key={name} className="text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-2">{name}</span>
                <span className="num text-ink-2">
                  {formatNumber(v)}원 <span className="text-ink-3">· {Math.round((v / total) * 100)}%</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-ink-3" style={{ width: `${(v / total) * 100}%` }} />
              </div>
            </div>
          ))}
      </div>
      {items.slice(0, 20).map((t) => (
        <TxnRow key={t.id} t={t} />
      ))}
      {items.length > 20 && <p className="py-2 text-center text-[13px] text-ink-3">외 {items.length - 20}건은 내역 탭에서 볼 수 있어요</p>}
    </div>
  );
}
