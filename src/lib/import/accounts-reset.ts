import type { Account, RecordDraft, SheetSettings } from "../types";
import type { AssetRow } from "./assets";

/** 시트 '가계부 설정' 계좌표 한 줄 (P 구분 ~ V 숨기기) */
export interface NewAccount {
  kind: "자산" | "부채";
  category: string;
  subcategory: string;
  name: string;
  start: number;
  memo: string;
  hidden: boolean;
  /** 화면 표시용: 맞춘 뒤 잔액(뱅크샐러드 금액) */
  balance: number;
  /** 예전 시트 계좌 이름 (이름이 바뀌는 경우) */
  renamedFrom?: string;
}

export interface ResetPlan {
  accounts: NewAccount[];
  renames: { from: string; to: string }[];
  /** 목록에서 빠지는 예전 계좌 */
  removed: string[];
}

export const MAX_ACCOUNTS = 70; // 시트 계좌표 O13:V82

function pickCategory(settings: SheetSettings, kind: "자산" | "부채", re: RegExp | null) {
  const list = settings.categories.filter((c) => c.kind === kind);
  return (re && list.find((c) => re.test(c.name))) || list[0];
}

function pickSub(subs: { name: string }[], re: RegExp | null) {
  return (re && subs.find((s) => re.test(s.name))?.name) || subs[0]?.name || "";
}

/** 뱅크샐러드 항목 → 시트 대분류·소분류 */
function classify(settings: SheetSettings, row: AssetRow) {
  const text = `${row.kind} ${row.name}`;
  if (row.side === "부채") {
    const card = /카드/.test(text);
    const cat = pickCategory(settings, "부채", card ? /카드/ : /대출/);
    return { category: cat?.name ?? "", subcategory: pickSub(cat?.subs ?? [], card ? /일시불/ : /대출/) };
  }
  let catRe: RegExp;
  let subRe: RegExp;
  if (/현금\s*자산|^현금$/.test(text)) [catRe, subRe] = [/현금|예금/, /현금/];
  else if (/CMA/i.test(text)) [catRe, subRe] = [/현금|예금/, /CMA/i];
  else if (/입출금|전자금융|페이|머니|포인트/.test(text)) [catRe, subRe] = [/현금|예금/, /입출금/];
  else if (/코인|가상/.test(text)) [catRe, subRe] = [/저축|투자/, /코인/];
  else if (/투자|증권|주식|펀드|ETF/i.test(text)) [catRe, subRe] = [/저축|투자/, /주식/];
  else if (/저축|신탁|연금|보험|적금|예금|청약/.test(text)) [catRe, subRe] = [/저축|투자/, /예적금/];
  else [catRe, subRe] = [/기타/, /예치금/];
  const cat = pickCategory(settings, "자산", catRe);
  return { category: cat?.name ?? "", subcategory: pickSub(cat?.subs ?? [], subRe) };
}

// ── 잔액 기준일 ──
// 뱅크샐러드 현황 금액은 그날까지 쓴 내역이 이미 반영된 잔액이다. 계좌 메모에 "잔액기준 YYYY-MM-DD"로 남겨서,
// 나중에 그날 이전·당일 내역이 들어오면 시작금액을 되돌려 맞춘다 (잔고가 두 번 빠지지 않게).

const AS_OF = /\s*·?\s*잔액기준 (\d{4}-\d{2}-\d{2})/;

export function asOfOf(memo: string): string | null {
  return memo.match(AS_OF)?.[1] ?? null;
}

export function withAsOf(memo: string, date: string): string {
  const base = memo.replace(AS_OF, "").trim();
  return base ? `${base} · 잔액기준 ${date}` : `잔액기준 ${date}`;
}

/**
 * 기준일이 있는 계좌에 기준일 이전·당일 기록을 새로 넣을 때 시작금액 보정값.
 * 그 기록은 이미 현황 금액에 들어 있으니, 기록이 잔고에 주는 영향만큼 시작금액에서 뺀다.
 */
export function compensations(
  accounts: Account[],
  drafts: RecordDraft[],
  /** 지우거나 고치기 전 기록 (빠지는 만큼 되돌린다) */
  removed: RecordDraft[] = [],
): { name: string; delta: number }[] {
  const out = new Map<string, number>();
  const seen = new Set<string>();
  for (const a of accounts) {
    if (seen.has(a.name)) continue;
    seen.add(a.name);
    const asOf = asOfOf(a.memo);
    if (!asOf) continue;
    const names = new Set([a.name]);
    const debt = a.kind === "부채";
    const e = effect(drafts, names, debt, asOf) - effect(removed, names, debt, asOf);
    if (e) out.set(a.name, -e);
  }
  return [...out].map(([name, delta]) => ({ name, delta }));
}

/** 기록이 계좌 잔액에 주는 영향 (시트 잔고 보고서와 같은 계산) */
function effect(records: RecordDraft[], names: Set<string>, debt: boolean, until: string) {
  let n = 0;
  for (const r of records) {
    if (r.date > until) continue;
    if (r.inAccount && names.has(r.inAccount)) n += debt ? -r.amount : r.amount;
    if (r.outAccount && names.has(r.outAccount)) n += debt ? r.amount : -r.amount;
  }
  return n;
}

/**
 * 뱅크샐러드 자산·부채 현황으로 시트 계좌 목록을 통째로 바꾸는 계획.
 * - 이름은 뱅크샐러드 그대로. 예전 시트 계좌와 같은 것(matchOld)이면 기록 속 이름도 새 이름으로 바꾼다.
 * - 시작금액 = 뱅크샐러드 금액 − (기준일까지 기록의 영향) → 시트 잔액이 뱅크샐러드 금액과 같아진다.
 *   기준일 다음 날부터의 기록은 평소처럼 잔고에 더해진다.
 */
export function planReset(
  settings: SheetSettings,
  /** 시트 기록 + 이번에 같이 넣는 기록 */
  records: RecordDraft[],
  rows: AssetRow[],
  matchOld: (name: string) => string | undefined,
  /** 현황 금액이 언제까지의 내역을 반영한 것인지 (그날 포함) */
  asOf: string,
): ResetPlan {
  const oldByName = new Map<string, Account>();
  for (const a of settings.accounts) if (!oldByName.has(a.name)) oldByName.set(a.name, a);
  const usedOld = new Set<string>();
  const usedNew = new Set<string>();
  const renames: ResetPlan["renames"] = [];
  const accounts: NewAccount[] = [];

  for (const row of rows) {
    // 같은 이름이 두 번 나오면 (예: 카드 두 장) 뒤에 번호를 붙인다
    let name = row.name;
    for (let i = 2; usedNew.has(name); i++) name = `${row.name} ${i}`;
    usedNew.add(name);

    const old = matchOld(row.name);
    const from = old && !usedOld.has(old) && oldByName.has(old) ? old : undefined;
    if (from) {
      usedOld.add(from);
      if (from !== name) renames.push({ from, to: name });
    }
    const debt = row.side === "부채";
    const names = new Set([name, ...(from ? [from] : [])]);
    const { category, subcategory } = classify(settings, row);
    accounts.push({
      kind: row.side,
      category,
      subcategory,
      name,
      start: row.balance - effect(records, names, debt, asOf),
      memo: withAsOf(from ? (oldByName.get(from)?.memo ?? "") : "", asOf),
      hidden: false,
      balance: row.balance,
      renamedFrom: from && from !== name ? from : undefined,
    });
  }
  const removed = [...oldByName.keys()].filter((n) => !usedOld.has(n) && !usedNew.has(n));
  return { accounts, renames, removed };
}

/** 가져오기에서 처음 본 결제수단을 새 계좌로 만들 때의 분류 (카드면 부채 › 신용카드 › 일시불) */
export function newAccountFor(settings: SheetSettings, name: string) {
  const card = /카드/.test(name);
  const row: AssetRow = { side: card ? "부채" : "자산", kind: card ? "카드" : "자유입출금 자산", name, balance: 0 };
  return { kind: row.side, ...classify(settings, row), name, start: 0, memo: "", hidden: false };
}
