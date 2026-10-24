"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { balances, byCategory, fiscalMonths, fixedSet, fixedSplit, inMonth, monthEnd, netWorth, sumKind, type CategoryTotal } from "@/lib/analytics";
import { pct, shortWon, slices } from "@/lib/chart";
import { formatNumber, shiftMonth, splitEmoji } from "@/lib/format";
import { useData } from "@/lib/store";
import type { MoneyRecord, SheetSettings } from "@/lib/types";
import { useMonth } from "../app-shell";
import { Donut } from "../donut";
import { MonthSwitcher } from "../month-switcher";
import { SyncBadge } from "../sync-badge";
import { Card, PageHeader, Segmented } from "../ui";

export function ReportsScreen() {
  const [mode, setMode] = useState<"month" | "year">("month");
  const { month, setMonth } = useMonth();
  const { records, settings } = useData();
  const year = Number(month.slice(0, 4));
  return (
    <>
      <PageHeader
        title={
          mode === "month" ? (
            <MonthSwitcher />
          ) : (
            <div className="flex items-center gap-1 text-[17px] font-semibold">
              <button aria-label="이전 해" onClick={() => setMonth(shiftMonth(month, -12))} className="grid size-9 place-items-center rounded-full text-ink-2">
                ‹
              </button>
              <span className="num">{year}년</span>
              <button aria-label="다음 해" onClick={() => setMonth(shiftMonth(month, 12))} className="grid size-9 place-items-center rounded-full text-ink-2">
                ›
              </button>
            </div>
          )
        }
        right={<SyncBadge />}
      />
      <div className="px-4 pb-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "month", label: "월간 보고서" },
            { value: "year", label: "연간 보고서" },
          ]}
        />
      </div>
      {records && settings ? (
        mode === "month" ? (
          <MonthReport month={month} records={records} settings={settings} />
        ) : (
          <YearReport year={year} records={records} settings={settings} />
        )
      ) : null}
    </>
  );
}

// ── 공통 ─────────────────────────────────────────

function Delta({ now, before, good = "down", plain = false }: { now: number; before: number; good?: "up" | "down"; plain?: boolean }) {
  const d = now - before;
  if (!d) return <span className="text-ink-3">–</span>;
  const better = good === "up" ? d > 0 : d < 0;
  return (
    <span className={plain ? "text-ink-3" : better ? "text-[#1a9a5c]" : "text-danger"}>
      {d > 0 ? "▲" : "▼"}
      {shortWon(Math.abs(d))}
    </span>
  );
}

function Kpi({ label, value, tone = "", sub }: { label: string; value: string; tone?: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2/60 px-4 py-3">
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className={`num mt-0.5 text-[18px] font-bold ${tone}`}>{value}</p>
      {sub && <p className="num mt-0.5 text-[12px]">{sub}</p>}
    </div>
  );
}

function Title({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
      <h2 className="text-[16px] font-semibold">{children}</h2>
      {note && <span className="text-[12px] text-ink-3">{note}</span>}
    </div>
  );
}

function SplitBar({ a, b, aLabel, bLabel, aColor = "var(--series-7)", bColor = "var(--series-4)" }: { a: number; b: number; aLabel: string; bLabel: string; aColor?: string; bColor?: string }) {
  const total = a + b;
  if (!total) return <p className="px-5 pb-4 text-[13px] text-ink-3">내역이 없어요</p>;
  return (
    <div className="px-5 pb-4">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {a > 0 && <span style={{ width: `${(a / total) * 100}%`, background: aColor }} />}
        {b > 0 && <span className="flex-1" style={{ background: bColor }} />}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: aColor }} />
          {aLabel} <span className="num">{formatNumber(a)} ({pct(a / total)})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: bColor }} />
          {bLabel} <span className="num">{formatNumber(b)} ({pct(b / total)})</span>
        </span>
      </div>
    </div>
  );
}

function TopList({ list, n }: { list: MoneyRecord[]; n: number }) {
  const top = list.filter((r) => r.kind === "지출").sort((a, b) => b.amount - a.amount).slice(0, n);
  if (!top.length) return <p className="px-5 pb-4 text-[13px] text-ink-3">지출이 없어요</p>;
  return (
    <>
      {top.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3 px-5 py-2 text-[14px]">
          <span className="num w-5 text-ink-3">{i + 1}</span>
          <span className="num w-11 shrink-0 text-[12px] text-ink-3">{r.date.slice(5).replace("-", ".")}</span>
          <span className="min-w-0 flex-1 truncate">{r.content || splitEmoji(r.category ?? "").label}</span>
          <span className="num shrink-0">{formatNumber(r.amount)}</span>
        </div>
      ))}
    </>
  );
}

// ── 월간 ─────────────────────────────────────────

function MonthReport({ month, records, settings }: { month: string; records: MoneyRecord[]; settings: SheetSettings }) {
  const [kind, setKind] = useState<"지출" | "수입">("지출");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const prevMonth = shiftMonth(month, -1);

  const r = useMemo(() => {
    const cur = inMonth(records, month);
    const prev = inMonth(records, prevMonth);
    const fixed = fixedSet(settings);
    const curBal = balances(settings.accounts, records, monthEnd(month));
    const prevBal = balances(settings.accounts, records, monthEnd(prevMonth));
    return {
      cur,
      income: sumKind(cur, "수입"),
      expense: sumKind(cur, "지출"),
      pIncome: sumKind(prev, "수입"),
      pExpense: sumKind(prev, "지출"),
      cats: { 지출: byCategory(cur, "지출"), 수입: byCategory(cur, "수입") },
      pCats: { 지출: byCategory(prev, "지출"), 수입: byCategory(prev, "수입") },
      fixedExp: fixedSplit(cur, "지출", fixed),
      fixedInc: fixedSplit(cur, "수입", fixed),
      curBal,
      nw: netWorth(curBal),
      pNw: netWorth(prevBal),
      prevBal,
    };
  }, [records, settings, month, prevMonth]);

  const net = r.income - r.expense;
  const cats = r.cats[kind];
  const data = slices(cats.map((c) => [c.name, c.total]));
  const total = kind === "지출" ? r.expense : r.income;
  const prevOf = (name: string) => r.pCats[kind].find((c) => c.name === name);

  return (
    <>
      <Card>
        <Title note="전월 대비">수입·지출 요약</Title>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <Kpi label="총수입" value={formatNumber(r.income)} tone="text-income" sub={<Delta now={r.income} before={r.pIncome} good="up" />} />
          <Kpi label="총지출" value={formatNumber(r.expense)} sub={<Delta now={r.expense} before={r.pExpense} />} />
          <Kpi label="순수입" value={formatNumber(net)} tone={net < 0 ? "text-danger" : ""} sub={<Delta now={net} before={r.pIncome - r.pExpense} good="up" />} />
          <Kpi label="수입 대비 지출" value={r.income ? pct(r.expense / r.income) : "–"} sub={<span className="text-ink-3">{r.pIncome ? `지난달 ${pct(r.pExpense / r.pIncome)}` : " "}</span>} />
        </div>
      </Card>

      <Card className="mt-3">
        <div className="px-4 pt-4">
          <Segmented
            value={kind}
            onChange={(k) => {
              setKind(k);
              setSelected(null);
              setOpen(null);
            }}
            options={[
              { value: "지출", label: `분류별 지출` },
              { value: "수입", label: `분류별 수입` },
            ]}
          />
        </div>
        {cats.length ? (
          <>
            <div className="py-5">
              <Donut data={data} total={total} label={kind} selected={selected} onSelect={setSelected} />
            </div>
            <div className="flex px-5 pb-1 text-[11px] text-ink-3">
              <span className="flex-1">대분류 · 누르면 상세</span>
              <span className="w-24 text-right">이번 달</span>
              <span className="w-16 text-right">전월 대비</span>
            </div>
            {cats.map((c) => {
              const slice = data.find((d) => d.name === c.name || d.others?.includes(c.name));
              const p = prevOf(c.name);
              const isOpen = open === c.name;
              const { emoji, label } = splitEmoji(c.name);
              return (
                <div key={c.name} className="border-t border-line">
                  <button
                    onClick={() => {
                      setOpen(isOpen ? null : c.name);
                      setSelected(slice?.others ? "기타" : c.name);
                    }}
                    className="flex w-full items-center gap-2 px-5 py-3 text-left active:bg-surface-2"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: slice?.color }} />
                    <span className="min-w-0 flex-1 truncate text-[15px]">
                      {emoji} {label} <span className="text-[12px] text-ink-3">{pct(c.total / total)}</span>
                    </span>
                    <span className="num w-24 shrink-0 text-right text-[15px] font-medium">{formatNumber(c.total)}</span>
                    <span className="num w-16 shrink-0 text-right text-[12px]">
                      <Delta now={c.total} before={p?.total ?? 0} good={kind === "지출" ? "down" : "up"} />
                    </span>
                    <ChevronDown size={14} className={`shrink-0 text-ink-3 transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && <SubDetail cur={c} prev={p} kind={kind} />}
                </div>
              );
            })}
          </>
        ) : (
          <p className="py-10 text-center text-[14px] text-ink-3">{kind} 내역이 없어요</p>
        )}
      </Card>

      <Card className="mt-3">
        <Title note="시트에서 고정 체크한 소분류">지출 고정/변동 비율</Title>
        <SplitBar a={r.fixedExp.fixed} b={r.fixedExp.variable} aLabel="고정지출" bLabel="변동지출" />
        <Title>고정수입 vs 고정지출</Title>
        <SplitBar a={r.fixedInc.fixed} b={r.fixedExp.fixed} aLabel="고정수입" bLabel="고정지출" aColor="var(--series-1)" bColor="var(--series-2)" />
      </Card>

      <Card className="mt-3 pb-2">
        <Title>이번 달 지출 TOP 15</Title>
        <TopList list={r.cur} n={15} />
      </Card>

      <Card className="mt-3 pb-4">
        <Title note={`${Number(month.slice(5))}월 말 · 전월 대비`}>자산·부채·순자산</Title>
        <div className="grid grid-cols-2 gap-2 px-4">
          <Kpi label="자산" value={formatNumber(r.nw.assets)} tone="text-income" sub={<Delta now={r.nw.assets} before={r.pNw.assets} good="up" />} />
          <Kpi label="부채" value={formatNumber(r.nw.debts)} tone="text-danger" sub={<Delta now={r.nw.debts} before={r.pNw.debts} />} />
          <Kpi label="순자산" value={formatNumber(r.nw.net)} sub={<Delta now={r.nw.net} before={r.pNw.net} good="up" />} />
          <Kpi label="자기자본비율" value={r.nw.assets ? pct(r.nw.net / r.nw.assets, 1) : "–"} sub={<span className="text-ink-3">순자산 ÷ 자산</span>} />
        </div>
        <GroupTable cur={r.curBal} prev={r.prevBal} />
      </Card>
    </>
  );
}

function SubDetail({ cur, prev, kind }: { cur: CategoryTotal; prev?: CategoryTotal; kind: "지출" | "수입" }) {
  const names = [...new Set([...cur.subs.keys(), ...(prev ? prev.subs.keys() : [])])].sort((a, b) => (cur.subs.get(b) ?? 0) - (cur.subs.get(a) ?? 0));
  return (
    <div className="bg-surface-2/50 px-5 py-2">
      {names.map((n) => {
        const v = cur.subs.get(n) ?? 0;
        return (
          <div key={n} className="flex items-center gap-2 py-1.5 text-[13px]">
            <span className="min-w-0 flex-1 truncate text-ink-2">{n}</span>
            <span className="num w-24 text-right">{formatNumber(v)}</span>
            <span className="num w-16 text-right text-[12px]">
              <Delta now={v} before={prev?.subs.get(n) ?? 0} good={kind === "지출" ? "down" : "up"} />
            </span>
            <span className="w-3.5" />
          </div>
        );
      })}
    </div>
  );
}

function GroupTable({ cur, prev }: { cur: ReturnType<typeof balances>; prev: ReturnType<typeof balances> }) {
  const groups = new Map<string, { kind: string; now: number; before: number }>();
  for (const a of cur) {
    const g = groups.get(a.category) ?? { kind: a.kind, now: 0, before: 0 };
    g.now += a.balance;
    g.before += prev.find((p) => p.name === a.name)?.balance ?? 0;
    groups.set(a.category, g);
  }
  return (
    <div className="mt-3">
      {[...groups].map(([name, g]) => (
        <div key={name} className="flex items-center gap-2 px-5 py-2 text-[14px]">
          <span className="min-w-0 flex-1 truncate">
            {name} <span className="text-[11px] text-ink-3">{g.kind}</span>
          </span>
          <span className={`num ${g.kind === "부채" ? "text-danger" : ""}`}>{formatNumber(g.now)}</span>
          <span className="num w-16 text-right text-[12px]">
            <Delta now={g.now} before={g.before} good={g.kind === "부채" ? "down" : "up"} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 연간 ─────────────────────────────────────────

function YearReport({ year, records, settings }: { year: number; records: MoneyRecord[]; settings: SheetSettings }) {
  const [kind, setKind] = useState<"지출" | "수입">("지출");
  const [active, setActive] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const months = useMemo(() => fiscalMonths(year, settings.fiscalMonth || 1), [year, settings.fiscalMonth]);

  const r = useMemo(() => {
    const fixed = fixedSet(settings);
    const per = months.map((m) => {
      const list = inMonth(records, m);
      const f = fixedSplit(list, "지출", fixed);
      return { month: m, list, income: sumKind(list, "수입"), expense: sumKind(list, "지출"), fixedExp: f.fixed, fixedInc: fixedSplit(list, "수입", fixed).fixed };
    });
    const all = per.flatMap((p) => p.list);
    const used = per.filter((p) => p.income || p.expense).length || 1;
    return { per, all, used, income: sumKind(all, "수입"), expense: sumKind(all, "지출"), cats: { 지출: byCategory(all, "지출"), 수입: byCategory(all, "수입") }, fixedExp: per.reduce((n, p) => n + p.fixedExp, 0) };
  }, [records, settings, months]);

  const max = Math.max(...r.per.flatMap((p) => [p.income, p.expense]), 1);
  const H = 120;
  const sel = active !== null ? r.per[active] : null;
  const cats = r.cats[kind];
  const total = kind === "지출" ? r.expense : r.income;
  const label = (m: string) => `${Number(m.slice(5))}월`;

  return (
    <>
      <Card>
        <Title note={sel ? `${label(sel.month)} 수입 ${formatNumber(sel.income)} · 지출 ${formatNumber(sel.expense)}` : "막대를 눌러 보기"}>연간 수입·지출 한눈에</Title>
        <svg viewBox={`0 0 340 ${H + 18}`} className="w-full px-3" role="img" aria-label={`${year}년 월별 수입 지출`}>
          <line x1="0" x2="340" y1={H} y2={H} stroke="var(--line)" />
          {r.per.map((p, i) => {
            const x = 6 + i * 28;
            const hi = (p.income / max) * (H - 8);
            const he = (p.expense / max) * (H - 8);
            return (
              <g key={p.month} opacity={active !== null && active !== i ? 0.35 : 1} onClick={() => setActive(active === i ? null : i)} className="cursor-pointer">
                <rect x={x - 2} y="0" width="28" height={H + 18} fill="transparent" />
                {p.income > 0 && <rect x={x} y={H - hi} width="10" height={hi} rx="2" fill="var(--series-1)" />}
                {p.expense > 0 && <rect x={x + 12} y={H - he} width="10" height={he} rx="2" fill="var(--series-2)" />}
                <text x={x + 11} y={H + 13} fontSize="9" textAnchor="middle" fill="var(--ink-3)">
                  {Number(p.month.slice(5))}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex gap-4 px-5 pt-1 pb-4 text-[12px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: "var(--series-1)" }} />
            수입
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: "var(--series-2)" }} />
            지출
          </span>
        </div>
      </Card>

      <Card className="mt-3">
        <Title note={`${label(months[0])}~${label(months[11])}`}>연간 수입·지출 요약</Title>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <Kpi label="연간 총수입" value={formatNumber(r.income)} tone="text-income" sub={<span className="text-ink-3">월평균 {shortWon(r.income / r.used)}</span>} />
          <Kpi label="연간 총지출" value={formatNumber(r.expense)} sub={<span className="text-ink-3">월평균 {shortWon(r.expense / r.used)}</span>} />
          <Kpi label="연간 순수입" value={formatNumber(r.income - r.expense)} tone={r.income - r.expense < 0 ? "text-danger" : ""} />
          <Kpi label="수입 대비 지출" value={r.income ? pct(r.expense / r.income) : "–"} sub={<span className="text-ink-3">고정지출 {r.expense ? pct(r.fixedExp / r.expense) : "–"}</span>} />
        </div>
      </Card>

      <Card className="mt-3">
        <div className="px-4 pt-4">
          <Segmented
            value={kind}
            onChange={(k) => {
              setKind(k);
              setOpen(null);
            }}
            options={[
              { value: "지출", label: "분류별 지출" },
              { value: "수입", label: "분류별 수입" },
            ]}
          />
        </div>
        <div className="flex px-5 pt-3 pb-1 text-[11px] text-ink-3">
          <span className="flex-1">대분류 · 누르면 월별</span>
          <span className="w-16 text-right">월평균</span>
          <span className="w-24 text-right">연간</span>
          <span className="w-10 text-right">비율</span>
        </div>
        {cats.length ? (
          cats.map((c) => {
            const { emoji, label: l } = splitEmoji(c.name);
            const isOpen = open === c.name;
            return (
              <div key={c.name} className="border-t border-line">
                <button onClick={() => setOpen(isOpen ? null : c.name)} className="flex w-full items-center gap-1 px-5 py-3 text-left active:bg-surface-2">
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {emoji} {l}
                  </span>
                  <span className="num w-16 text-right text-[12px] text-ink-3">{shortWon(c.total / r.used)}</span>
                  <span className="num w-24 text-right text-[14px] font-medium">{formatNumber(c.total)}</span>
                  <span className="num w-10 text-right text-[12px] text-ink-3">{pct(c.total / total)}</span>
                </button>
                {isOpen && (
                  <div className="grid grid-cols-4 gap-x-2 gap-y-1.5 bg-surface-2/50 px-5 py-3">
                    {r.per.map((p) => {
                      const v = p.list.filter((x) => x.kind === kind && (x.category || "미분류") === c.name).reduce((n, x) => n + x.amount, 0);
                      return (
                        <div key={p.month} className="text-[12px]">
                          <span className="text-ink-3">{label(p.month)}</span> <span className="num">{v ? shortWon(v) : "–"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="py-8 text-center text-[14px] text-ink-3">{kind} 내역이 없어요</p>
        )}
      </Card>

      <Card className="mt-3 pb-2">
        <Title note="고정지출 비율">월별 상세</Title>
        <div className="flex px-5 pb-1 text-[11px] text-ink-3">
          <span className="w-10">월</span>
          <span className="flex-1 text-right">수입</span>
          <span className="flex-1 text-right">지출</span>
          <span className="flex-1 text-right">순수입</span>
          <span className="w-12 text-right">고정</span>
        </div>
        {r.per.map((p) => (
          <div key={p.month} className="num flex px-5 py-1.5 text-[13px]">
            <span className="w-10 text-ink-3">{label(p.month)}</span>
            <span className="flex-1 text-right text-income">{p.income ? shortWon(p.income) : "–"}</span>
            <span className="flex-1 text-right">{p.expense ? shortWon(p.expense) : "–"}</span>
            <span className={`flex-1 text-right ${p.income - p.expense < 0 ? "text-danger" : ""}`}>{p.income || p.expense ? shortWon(p.income - p.expense) : "–"}</span>
            <span className="w-12 text-right text-ink-3">{p.expense ? pct(p.fixedExp / p.expense) : "–"}</span>
          </div>
        ))}
      </Card>

      <Card className="mt-3 pb-2">
        <Title>올해 지출 TOP 20</Title>
        <TopList list={r.all} n={20} />
      </Card>
    </>
  );
}
