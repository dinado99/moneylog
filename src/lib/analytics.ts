import { shiftMonth } from "./format";
import type { Account, Kind, MoneyRecord, RecordDraft, SheetSettings } from "./types";

export const sumKind = (list: RecordDraft[], kind: Kind) => list.filter((r) => r.kind === kind).reduce((n, r) => n + r.amount, 0);

export function inMonth(list: MoneyRecord[], month: string) {
  return list.filter((r) => r.date.startsWith(month));
}

/** 회계연도: 회계기준월(f)부터 12개월. f=1이면 1~12월 */
export function fiscalMonths(year: number, fiscalMonth: number): string[] {
  const start = `${year}-${String(fiscalMonth).padStart(2, "0")}`;
  return Array.from({ length: 12 }, (_, i) => shiftMonth(start, i));
}

export interface CategoryTotal {
  name: string;
  total: number;
  subs: Map<string, number>;
  count: number;
}

/** 대분류별 합계 (소분류 포함) */
export function byCategory(list: RecordDraft[], kind: "수입" | "지출"): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const r of list) {
    if (r.kind !== kind) continue;
    const name = r.category || "미분류";
    const cur = map.get(name) ?? { name, total: 0, subs: new Map(), count: 0 };
    cur.total += r.amount;
    cur.count++;
    const sub = r.subcategory || "소분류 없음";
    cur.subs.set(sub, (cur.subs.get(sub) ?? 0) + r.amount);
    map.set(name, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** 시트 '가계부 설정'에서 고정으로 체크한 "대분류|소분류" */
export function fixedSet(settings: SheetSettings): Set<string> {
  const s = new Set<string>();
  for (const c of settings.categories) for (const sub of c.subs) if (sub.fixed) s.add(`${c.name}|${sub.name}`);
  return s;
}

export function fixedSplit(list: RecordDraft[], kind: "수입" | "지출", fixed: Set<string>) {
  let f = 0;
  let v = 0;
  for (const r of list) {
    if (r.kind !== kind) continue;
    if (fixed.has(`${r.category}|${r.subcategory}`)) f += r.amount;
    else v += r.amount;
  }
  return { fixed: f, variable: v };
}

// ── 잔고 ─────────────────────────────────────────

export interface AccountBalance {
  name: string;
  kind: "자산" | "부채";
  category: string;
  subcategories: string[];
  start: number;
  memo: string;
  hidden: boolean;
  balance: number;
}

/**
 * 시트 '잔고 보고서'와 같은 계산: 자산 = 시작금액 + 입금 − 출금, 부채(카드) = 시작금액 + 출금(사용) − 입금(상환).
 * 같은 이름 계좌(현대카드 일시불/할부)는 하나로 합친다 (기록에는 이름만 있어서 나눌 수 없음).
 * until(포함)까지의 기록만 센다.
 */
export function balances(accounts: Account[], list: RecordDraft[], until?: string): AccountBalance[] {
  const map = new Map<string, AccountBalance>();
  for (const a of accounts) {
    const cur = map.get(a.name);
    if (cur) {
      cur.start += a.start;
      cur.balance += a.start;
      if (a.subcategory && !cur.subcategories.includes(a.subcategory)) cur.subcategories.push(a.subcategory);
      if (a.memo && !cur.memo) cur.memo = a.memo;
      cur.hidden = cur.hidden && a.hidden;
    } else {
      map.set(a.name, {
        name: a.name,
        kind: a.kind,
        category: a.category,
        subcategories: a.subcategory ? [a.subcategory] : [],
        start: a.start,
        memo: a.memo,
        hidden: a.hidden,
        balance: a.start,
      });
    }
  }
  for (const r of list) {
    if (until && r.date > until) continue;
    const inAcc = r.inAccount && map.get(r.inAccount);
    const outAcc = r.outAccount && map.get(r.outAccount);
    if (inAcc) inAcc.balance += inAcc.kind === "부채" ? -r.amount : r.amount;
    if (outAcc) outAcc.balance += outAcc.kind === "부채" ? r.amount : -r.amount;
  }
  return [...map.values()];
}

export function netWorth(list: AccountBalance[]) {
  const assets = list.filter((a) => a.kind === "자산").reduce((n, a) => n + a.balance, 0);
  const debts = list.filter((a) => a.kind === "부채").reduce((n, a) => n + a.balance, 0);
  return { assets, debts, net: assets - debts };
}

/** YYYY-MM 말일 */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

// ── 달력 일정 ────────────────────────────────────

/** 그 달에 일정이 잡히는 날. 없는 날(31일)은 말일로, 주말이면 당기기(금)/밀기(월). 달을 넘어가면 null */
export function scheduleDay(day: number, weekend: "당기기" | "밀기" | null, month: string): number | null {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  let d = Math.min(day, last);
  const wd = new Date(y, m - 1, d).getDay();
  if (wd === 0 || wd === 6) {
    if (weekend === "당기기") d -= wd === 6 ? 1 : 2;
    if (weekend === "밀기") d += wd === 6 ? 2 : 1;
  }
  return d >= 1 && d <= last ? d : null;
}
