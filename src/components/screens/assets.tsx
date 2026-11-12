"use client";

import { useMemo, useState } from "react";
import {
  balances,
  monthEnd,
  netWorth,
  type AccountBalance,
} from "@/lib/analytics";
import { shortWon } from "@/lib/chart";
import {
  currentMonth,
  formatNumber,
  shiftMonth,
  todayString,
} from "@/lib/format";
import { useConnection } from "@/lib/connection";
import {
  CURRENCIES,
  currencyInfo,
  formatFx,
  fxLedger,
  fxOf,
  holdingsOf,
  toWon,
  useRates,
  withFx,
  type FxHolding,
} from "@/lib/fx";
import { SheetError } from "@/lib/sheet";
import { saveMemo, useData } from "@/lib/store";
import { Sheet } from "../sheet";
import { SyncBadge } from "../sync-badge";
import { Button, Card, PageHeader, Segmented } from "../ui";

function Change({
  now,
  before,
  debt,
}: {
  now: number;
  before: number;
  debt?: boolean;
}) {
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
  const [fxEdit, setFxEdit] = useState<AccountBalance | null>(null);
  const { data: fx } = useRates();

  const r = useMemo(() => {
    if (!records || !settings) return null;
    const today = todayString();
    const thisMonth = currentMonth();
    const now = balances(settings.accounts, records, today);
    const lastMonthEnd = balances(
      settings.accounts,
      records,
      monthEnd(shiftMonth(thisMonth, -1)),
    );
    const yearStart = balances(
      settings.accounts,
      records,
      `${Number(thisMonth.slice(0, 4)) - 1}-12-31`,
    );
    const trend = Array.from({ length: 12 }, (_, i) => {
      const m = shiftMonth(thisMonth, i - 11);
      const end = i === 11 ? today : monthEnd(m);
      return {
        month: m,
        ...netWorth(balances(settings.accounts, records, end)),
      };
    });
    return {
      ledger: fxLedger(records, today),
      now,
      lastMonthEnd,
      yearStart,
      nw: netWorth(now),
      pnw: netWorth(lastMonthEnd),
      trend,
    };
  }, [records, settings]);

  if (!r) return <PageHeader title="자산" right={<SyncBadge />} />;

  const before = (list: AccountBalance[], name: string) =>
    list.find((a) => a.name === name)?.balance ?? 0;
  const groups = new Map<string, AccountBalance[]>();
  for (const a of r.now) {
    if (a.hidden && !showHidden) continue;
    groups.set(a.category, [...(groups.get(a.category) ?? []), a]);
  }
  const ordered = [...groups].sort((a, b) =>
    a[1][0].kind === b[1][0].kind ? 0 : a[1][0].kind === "자산" ? -1 : 1,
  );
  const hiddenCount = r.now.filter((a) => a.hidden).length;
  // 외화 = 메모의 시작 외화 + 외화로 적은 기록(충전 이동 +, 지출 −).
  // 원화 잔고에는 충전할 때 낸 원화가 이미 들어 있어서 순자산에 따로 더하지 않는다
  const holdings = (a: AccountBalance) =>
    holdingsOf(a.memo, r.ledger.get(a.name));
  const fxAll = r.now.filter((a) => a.kind === "자산").flatMap(holdings);
  const fxWon = toWon(fxAll, fx?.rates);

  return (
    <>
      <PageHeader title="자산" right={<SyncBadge />} />
      <div className="mx-4 grid grid-cols-3 rounded-3xl bg-surface py-4 text-center">
        <div>
          <p className="text-[12px] text-ink-3">자산</p>
          <p className="num mt-1 text-[15px] font-bold text-income">
            {formatNumber(r.nw.assets)}
          </p>
        </div>
        <div className="border-x border-line">
          <p className="text-[12px] text-ink-3">부채</p>
          <p className="num mt-1 text-[15px] font-bold text-danger">
            {formatNumber(r.nw.debts)}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-ink-3">순자산</p>
          <p className="num mt-1 text-[15px] font-bold">
            {formatNumber(r.nw.net)}
          </p>
        </div>
      </div>
      <p className="num px-5 pt-2 text-right text-[12px] text-ink-3">
        지난달 말보다 순자산 <Change now={r.nw.net} before={r.pnw.net} />
      </p>
      {fxAll.length > 0 && (
        <p className="num px-5 pt-1 text-right text-[12px] text-ink-3">
          외화{" "}
          {fxWon === null
            ? "환율 불러오는 중"
            : `지금 환율로 ≈ ${formatNumber(fxWon)}원`}
        </p>
      )}
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
                <section
                  key={cat}
                  className="mx-4 overflow-hidden rounded-3xl bg-surface"
                >
                  <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                    <span className="flex-1 text-[15px] font-semibold">
                      {cat}
                    </span>
                    <span
                      className={`num text-[14px] font-semibold ${debt ? "text-danger" : "text-income"}`}
                    >
                      {formatNumber(sum)}원
                    </span>
                  </div>
                  <div className="flex px-5 pb-1 text-[11px] text-ink-3">
                    <span className="flex-1">계좌</span>
                    <span className="w-16 text-right">전월말 대비</span>
                    <span className="w-16 text-right">연초 대비</span>
                  </div>
                  {list.map((a) => {
                    const held = holdings(a);
                    const memo = withFx(a.memo, []);
                    const heldWon = toWon(held, fx?.rates);
                    return (
                      <button
                        key={a.name}
                        onClick={() => setFxEdit(a)}
                        className="block w-full border-t border-line px-5 py-3 text-left active:bg-surface-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px]">
                              {a.name}
                              {a.hidden && (
                                <span className="ml-1 text-[11px] text-ink-3">
                                  숨김
                                </span>
                              )}
                            </span>
                            <span
                              className={`num block text-[14px] font-medium ${a.balance < 0 || debt ? "text-danger" : a.balance === 0 ? "text-ink-3" : ""}`}
                            >
                              {formatNumber(a.balance)}원
                            </span>
                          </span>
                          <span className="num w-16 text-right text-[12px]">
                            <Change
                              now={a.balance}
                              before={before(r.lastMonthEnd, a.name)}
                              debt={debt}
                            />
                          </span>
                          <span className="num w-16 text-right text-[12px]">
                            <Change
                              now={a.balance}
                              before={before(r.yearStart, a.name)}
                              debt={debt}
                            />
                          </span>
                        </div>
                        {held.length > 0 && (
                          <p className="num mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                            {held.map((h) => (
                              <span key={h.currency}>
                                {currencyInfo(h.currency).flag} {formatFx(h)}
                              </span>
                            ))}
                            {heldWon !== null && (
                              <span className="text-[12px] text-ink-3">
                                ≈ {formatNumber(heldWon)}원
                              </span>
                            )}
                          </p>
                        )}
                        {(memo || a.subcategories.length > 0) && (
                          <p className="mt-0.5 truncate text-[12px] text-ink-3">
                            {[a.subcategories.join("·"), memo]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </div>
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="mx-auto mt-3 block text-[13px] text-ink-3"
            >
              {showHidden
                ? "숨긴 계좌 감추기"
                : `숨긴 계좌 ${hiddenCount}개 보기`}
            </button>
          )}
          <p className="mx-5 mt-3 text-[12px] leading-relaxed text-ink-3">
            잔고 = 시트 &apos;가계부 설정&apos;의 시작금액 + 입금 − 출금 (카드는
            쓴 만큼 늘고 갚은 만큼 줄어요). 이름이 같은 계좌(일시불·할부)는
            하나로 합쳐 보여요. 계좌를 누르면 외화(달러·엔 등) 보유액을 적을 수
            있어요. 시트 계좌 메모에 저장되고, 원화 잔고와는 따로 보여요.
          </p>
        </>
      ) : (
        <Trend trend={r.trend} />
      )}
      <Sheet open={!!fxEdit} onClose={() => setFxEdit(null)}>
        {fxEdit && (
          <FxForm
            held={holdings(fxEdit)}
            account={fxEdit}
            rates={fx?.rates}
            rateDate={fx?.date}
            onClose={() => setFxEdit(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function FxForm({
  account,
  rates,
  rateDate,
  onClose,
  held,
}: {
  held: FxHolding[];
  account: AccountBalance;
  rates?: Record<string, number>;
  rateDate?: string;
  onClose: () => void;
}) {
  const conn = useConnection();
  const [rows, setRows] = useState<{ currency: string; amount: string }[]>(
    () => {
      const held = fxOf(account.memo);
      return held.length
        ? held.map((h) => ({ currency: h.currency, amount: String(h.amount) }))
        : [{ currency: "USD", amount: "" }];
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list: FxHolding[] = rows.map((r) => ({
    currency: r.currency,
    amount: Number(r.amount.replace(/,/g, "")) || 0,
  }));
  const used = new Set(rows.map((r) => r.currency));

  async function save() {
    if (!conn) return;
    setBusy(true);
    setError(null);
    try {
      // 같은 통화는 합쳐서 저장
      const merged = new Map<string, number>();
      for (const h of list)
        merged.set(h.currency, (merged.get(h.currency) ?? 0) + h.amount);
      await saveMemo(
        conn,
        account.name,
        withFx(
          account.memo,
          [...merged].map(([currency, amount]) => ({ currency, amount })),
        ),
      );
      onClose();
    } catch (e) {
      setError(
        e instanceof SheetError
          ? e.message
          : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 pb-5">
      <p className="text-[17px] font-semibold">{account.name} 외화</p>
      {held.length > 0 && (
        <p className="num mt-2 text-[15px] font-medium">
          지금{" "}
          {held
            .map((h) => `${currencyInfo(h.currency).flag} ${formatFx(h)}`)
            .join("  ")}
        </p>
      )}
      <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
        외화 충전(예: 우리은행 → {account.name})은 내역에 &apos;이동&apos;으로,
        여행 가서 쓴 건 &apos;지출&apos;로 외화를 같이 적으면 여기 외화가 저절로
        늘고 줄어요. 아래에는 기록 없이 원래 들고 있던 <b>시작 외화</b>만
        적어요.
      </p>
      <div className="mt-4 space-y-2">
        {rows.map((row, i) => {
          const won = toWon([list[i]], rates);
          return (
            <div key={i} className="flex items-center gap-2">
              <select
                value={row.currency}
                onChange={(e) =>
                  setRows(
                    rows.map((x, j) =>
                      j === i ? { ...x, currency: e.target.value } : x,
                    ),
                  )
                }
                className="h-11 w-28 shrink-0 rounded-xl bg-surface-2 px-2 text-[14px] outline-none"
              >
                {CURRENCIES.filter(
                  (c) => c.code === row.currency || !used.has(c.code),
                ).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
              <span className="min-w-0 flex-1">
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={row.amount}
                  onChange={(e) =>
                    setRows(
                      rows.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              amount: e.target.value.replace(/[^\d.,-]/g, ""),
                            }
                          : x,
                      ),
                    )
                  }
                  className="num h-11 w-full rounded-xl bg-surface-2 px-3 text-right text-[16px] outline-none"
                />
                {won !== null && list[i].amount !== 0 && (
                  <span className="num mt-0.5 block text-right text-[11px] text-ink-3">
                    ≈ {formatNumber(won)}원
                  </span>
                )}
              </span>
              <button
                aria-label="빼기"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="grid size-9 shrink-0 place-items-center rounded-full text-[20px] text-ink-3 active:bg-surface-2"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {used.size < CURRENCIES.length && (
        <button
          onClick={() =>
            setRows([
              ...rows,
              {
                currency: CURRENCIES.find((c) => !used.has(c.code))!.code,
                amount: "",
              },
            ])
          }
          className="mt-3 text-[14px] font-medium text-accent"
        >
          ＋ 통화 추가
        </button>
      )}
      {rateDate && (
        <p className="mt-3 text-[12px] text-ink-3">
          환율 {rateDate} 기준 (무료 환율 정보, 하루 한 번 바뀌어요)
        </p>
      )}
      {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}
      <Button className="mt-5 w-full" disabled={busy || !conn} onClick={save}>
        {busy ? "저장하는 중" : "시트에 저장"}
      </Button>
    </div>
  );
}

function Trend({
  trend,
}: {
  trend: { month: string; assets: number; debts: number; net: number }[];
}) {
  const [active, setActive] = useState(trend.length - 1);
  const W = 340;
  const H = 130;
  const vals = trend.map((t) => t.net);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || Math.max(Math.abs(max), 1);
  const xy = trend.map(
    (t, i) =>
      [
        14 + (i * (W - 28)) / (trend.length - 1),
        14 + (1 - (t.net - min) / span) * (H - 36),
      ] as const,
  );
  const a = trend[active];
  return (
    <>
      <Card className="p-5">
        <p className="text-[13px] text-ink-3">
          {active === trend.length - 1
            ? "지금"
            : `${Number(a.month.slice(5))}월 말`}{" "}
          순자산
        </p>
        <p className="num text-[26px] font-bold">{formatNumber(a.net)}원</p>
        <svg
          viewBox={`0 0 ${W} ${H + 14}`}
          className="mt-2 w-full touch-none"
          role="img"
          aria-label="월말 순자산 추이"
        >
          <line x1="0" x2={W} y1={H - 12} y2={H - 12} stroke="var(--line)" />
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={xy.map(([x, y]) => `${x},${y}`).join(" ")}
          />
          {xy.map(([x, y], i) => (
            <g key={i}>
              <rect
                x={x - 14}
                y="0"
                width="28"
                height={H}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onClick={() => setActive(i)}
              />
              {i === active && (
                <circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              )}
              {(i % 2 === 1 || i === trend.length - 1) && (
                <text
                  x={x}
                  y={H + 8}
                  fontSize="9"
                  textAnchor="middle"
                  fill="var(--ink-3)"
                >
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
            <span className="w-12 text-ink-3">
              {i === 0 ? "지금" : `${Number(t.month.slice(5))}월`}
            </span>
            <span className="flex-1 text-right">{shortWon(t.assets)}</span>
            <span className="flex-1 text-right text-danger">
              {shortWon(t.debts)}
            </span>
            <span className="flex-1 text-right font-medium">
              {shortWon(t.net)}
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}
