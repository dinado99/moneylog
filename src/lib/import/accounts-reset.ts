import type { Account, MoneyRecord, SheetSettings } from "../types";
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

/** 기록이 계좌 잔액에 주는 영향 (시트 잔고 보고서와 같은 계산) */
function effect(records: MoneyRecord[], names: Set<string>, debt: boolean, until: string) {
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
 * - 시작금액 = 뱅크샐러드 금액 − (오늘까지 기록의 영향) → 시트 잔액이 뱅크샐러드 금액과 같아진다.
 */
export function planReset(
  settings: SheetSettings,
  records: MoneyRecord[],
  rows: AssetRow[],
  matchOld: (name: string) => string | undefined,
  today: string,
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
      start: row.balance - effect(records, names, debt, today),
      memo: from ? (oldByName.get(from)?.memo ?? "") : "",
      hidden: false,
      balance: row.balance,
      renamedFrom: from && from !== name ? from : undefined,
    });
  }
  const removed = [...oldByName.keys()].filter((n) => !usedOld.has(n) && !usedNew.has(n));
  return { accounts, renames, removed };
}
