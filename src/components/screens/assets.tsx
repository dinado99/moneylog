"use client";

import { useMemo, useState } from "react";
import { balances, monthEnd, netWorth, type AccountBalance } from "@/lib/analytics";
import { shortWon } from "@/lib/chart";
import { currentMonth, formatNumber, shiftMonth, todayString } from "@/lib/format";
import { useData } from "@/lib/store";
import { SyncBadge } from "../sync-badge";
import { Card, PageHeader, Segmented } from "../ui";

function Change({ now, before, debt }: { now: number; before: number; debt?: boolean }) {
  const d = now - before;
  if (!d) return <span className="text-ink-3">–</span>;
  const good = debt ? d < 0 : d > 0;
  return (
    <span className={good ? "text-[#1a9a5c]" : "text-danger"}>
      {d > 0 ? "+" : "−"}
      {shortWon(Math.abs(d))}
    </span>
  );
}

export function AssetsScreen() {
  const { records, settings } = useData();
  const [view, setView] = useState<"list" | "trend">("list");
  const [showHidden, setShowHidden] = useState(false);

  const r = useMemo(() => {
    if (!records || !settings) return null;
    const today = todayString();
    const thisMonth = currentMonth();
    const now = balances(settings.accounts, records, today);
    const lastMonthEnd = balances(settings.accounts, records, monthEnd(shiftMonth(thisMonth, -1)));
    const yearStart = balances(settings.accounts, records, `${Number(thisMonth.slice(0, 4)) - 1}-12-31`);
    const trend = Array.from({ length: 12 }, (_, i) => {
      const m = shiftMonth(thisMonth, i - 11);
      const end = i === 11 ? today : monthEnd(m);
      return { month: m, ...netWorth(balances(settings.accounts, records, end)) };
    });
    return { now, lastMonthEnd, yearStart, nw: netWorth(now), pnw: netWorth(lastMonthEnd), trend };
  }, [records, settings]);

  if (!r) return <PageHeader title="자산" right={<SyncBadge />} />;

  const before = (list: AccountBalance[], name: string) => list.find((a) => a.name === name)?.balance ?? 0;
  const groups = new Map<string, AccountBalance[]>();
  for (const a of r.now) {
    if (a.hidden && !showHidden) continue;
    groups.set(a.category, [...(groups.get(a.category) ?? []), a]);
  }
  const ordered = [...groups].sort((a, b) => (a[1][0].kind === b[1][0].kind ? 0 : a[1][0].kind === "자산" ? -1 : 1));
  const hiddenCount = r.now.filter((a) => a.hidden).length;

  return (
    <>
      <PageHeader title="자산" right={<SyncBadge />} />
      <div className="mx-4 grid grid-cols-3 rounded-3xl bg-surface py-4 text-center">
        <div>
          <p className="text-[12px] text-ink-3">자산</p>
          <p className="num mt-1 text-[15px] font-bold text-income">{formatNumber(r.nw.assets)}</p>
        </div>
        <div className="border-x border-line">
          <p className="text-[12px] text-ink-3">부채</p>
          <p className="num mt-1 text-[15px] font-bold text-danger">{formatNumber(r.nw.debts)}</p>
        </div>
        <div>
          <p className="text-[12px] text-ink-3">순자산</p>
          <p className="num mt-1 text-[15px] font-bold">{formatNumber(r.nw.net)}</p>
        </div>
      </div>
      <p className="num px-5 pt-2 text-right text-[12px] text-ink-3">
        지난달 말보다 순자산 <Change now={r.nw.net} before={r.pnw.net} />
      </p>
      <div className="px-4 py-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "잔고" },
            { value: "trend", label: "순자산 추이" },
          ]}
        />
      </div>

      {view === "list" ? (
        <>
          <div className="space-y-3">
            {ordered.map(([cat, list]) => {
              const debt = list[0].kind === "부채";
              const sum = list.reduce((n, a) => n + a.balance, 0);
              return (
                <section key={cat} className="mx-4 overflow-hidden rounded-3xl bg-surface">
                  <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                    <span className="flex-1 text-[15px] font-semibold">{cat}</span>
                    <span className={`num text-[14px] font-semibold ${debt ? "text-danger" : "text-income"}`}>{formatNumber(sum)}원</span>
                  </div>
                  <div className="flex px-5 pb-1 text-[11px] text-ink-3">
                    <span className="flex-1">계좌</span>
                    <span className="w-16 text-right">전월말 대비</span>
                    <span className="w-16 text-right">연초 대비</span>
                  </div>
                  {list.map((a) => (
                    <div key={a.name} className="border-t border-line px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px]">
                            {a.name}
                            {a.hidden && <span className="ml-1 text-[11px] text-ink-3">숨김</span>}
                          </span>
                          <span className={`num block text-[14px] font-medium ${a.balance < 0 || debt ? "text-danger" : a.balance === 0 ? "text-ink-3" : ""}`}>
                            {formatNumber(a.balance)}원
                          </span>
                        </span>
                        <span className="num w-16 text-right text-[12px]">
                          <Change now={a.balance} before={before(r.lastMonthEnd, a.name)} debt={debt} />
                        </span>
                        <span className="num w-16 text-right text-[12px]">
                          <Change now={a.balance} before={before(r.yearStart, a.name)} debt={debt} />
                        </span>
                      </div>
                      {(a.memo || a.subcategories.length > 0) && (
                        <p className="mt-0.5 truncate text-[12px] text-ink-3">{[a.subcategories.join("·"), a.memo].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
          {hiddenCount > 0 && (
            <button onClick={() => setShowHidden(!showHidden)} className="mx-auto mt-3 block text-[13px] text-ink-3">
              {showHidden ? "숨긴 계좌 감추기" : `숨긴 계좌 ${hiddenCount}개 보기`}
            </button>
          )}
          <p className="mx-5 mt-3 text-[12px] leading-relaxed text-ink-3">
            잔고 = 시트 &apos;가계부 설정&apos;의 시작금액 + 입금 − 출금 (카드는 쓴 만큼 늘고 갚은 만큼 줄어요). 이름이 같은 계좌(일시불·할부)는 하나로 합쳐 보여요.
          </p>
        </>
      ) : (
        <Trend trend={r.trend} />
      )}
    </>
  );
}

function Trend({ trend }: { trend: { month: string; assets: number; debts: number; net: number }[] }) {
  const [active, setActive] = useState(trend.length - 1);
  const W = 340;
  const H = 130;
  const vals = trend.map((t) => t.net);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || Math.max(Math.abs(max), 1);
  const xy = trend.map((t, i) => [14 + (i * (W - 28)) / (trend.length - 1), 14 + (1 - (t.net - min) / span) * (H - 36)] as const);
  const a = trend[active];
  return (
    <>
      <Card className="p-5">
        <p className="text-[13px] text-ink-3">{active === trend.length - 1 ? "지금" : `${Number(a.month.slice(5))}월 말`} 순자산</p>
        <p className="num text-[26px] font-bold">{formatNumber(a.net)}원</p>
        <svg viewBox={`0 0 ${W} ${H + 14}`} className="mt-2 w-full touch-none" role="img" aria-label="월말 순자산 추이">
          <line x1="0" x2={W} y1={H - 12} y2={H - 12} stroke="var(--line)" />
          <polyline fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={xy.map(([x, y]) => `${x},${y}`).join(" ")} />
          {xy.map(([x, y], i) => (
            <g key={i}>
              <rect x={x - 14} y="0" width="28" height={H} fill="transparent" onPointerEnter={() => setActive(i)} onClick={() => setActive(i)} />
              {i === active && <circle cx={x} cy={y} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />}
              {(i % 2 === 1 || i === trend.length - 1) && (
                <text x={x} y={H + 8} fontSize="9" textAnchor="middle" fill="var(--ink-3)">
                  {Number(trend[i].month.slice(5))}월
                </text>
              )}
            </g>
          ))}
        </svg>
      </Card>
      <Card className="mt-3 py-2">
        <div className="flex px-5 pt-2 pb-1 text-[11px] text-ink-3">
          <span className="w-12">월말</span>
          <span className="flex-1 text-right">자산</span>
          <span className="flex-1 text-right">부채</span>
          <span className="flex-1 text-right">순자산</span>
        </div>
        {[...trend].reverse().map((t, i) => (
          <div key={t.month} className="num flex px-5 py-1.5 text-[13px]">
            <span className="w-12 text-ink-3">{i === 0 ? "지금" : `${Number(t.month.slice(5))}월`}</span>
            <span className="flex-1 text-right">{shortWon(t.assets)}</span>
            <span className="flex-1 text-right text-danger">{shortWon(t.debts)}</span>
            <span className="flex-1 text-right font-medium">{shortWon(t.net)}</span>
          </div>
        ))}
      </Card>
    </>
  );
}
