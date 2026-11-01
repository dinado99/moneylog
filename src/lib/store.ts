"use client";

import { useMemo } from "react";
import useSWR, { mutate } from "swr";
import { useConnection } from "./connection";
import { keyOfRow, toSheetRow, fromSheetRow, type SheetRow } from "./record-key";
import type { Rule } from "./import/to-sheet";
import type { ResetPlan } from "./import/accounts-reset";
import { pullSheet, pushSheet, replaceAccounts, saveRules, type Connection, type SheetOp } from "./sheet";
import type { MoneyRecord, RecordDraft, SheetSettings } from "./types";

export interface SheetData {
  rows: SheetRow[];
  settings: SheetSettings;
  rules: Rule[];
  version: number;
  fetchedAt: string;
}

const CACHE = "moneylog:sheet-cache";
const KEY = ["sheet"];

function readCache(): SheetData | undefined {
  try {
    const raw = localStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as SheetData) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(d: SheetData) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(d));
  } catch {}
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE);
  } catch {}
}

async function fetchSheet(c: Connection): Promise<SheetData> {
  const { records, settings, rules, version } = await pullSheet(c);
  const data = { rows: records, settings, rules, version, fetchedAt: new Date().toISOString() };
  writeCache(data);
  return data;
}

/** 시트 데이터. 마지막으로 받은 내용을 먼저 보여주고 시트에서 새로 받아 온다. */
export function useSheet() {
  const conn = useConnection();
  return useSWR(conn ? [...KEY, conn.url] : null, () => fetchSheet(conn!), {
    fallbackData: conn ? readCache() : undefined,
    revalidateOnFocus: true,
    focusThrottleInterval: 30_000,
    dedupingInterval: 5_000,
  });
}

/** 시트 줄 → 화면용 기록 (같은 내용 줄은 순번으로 구분) */
export function toRecords(rows: SheetRow[]): MoneyRecord[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = keyOfRow(row);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return { ...fromSheetRow(row), key, id: `${key}#${n}` };
  });
}

/** 시트에 보낸 작업을 받아 둔 데이터에도 똑같이 적용 (다시 받기 전까지 화면이 바로 바뀌게) */
export function applyOps(rows: SheetRow[], ops: SheetOp[]): SheetRow[] {
  const next = [...rows];
  for (const op of ops) {
    const i = op.op === "add" ? -1 : next.findIndex((r) => keyOfRow(r) === op.match);
    if (op.op === "delete") {
      if (i >= 0) next.splice(i, 1);
    } else if (i >= 0) next[i] = op.row;
    else next.push(op.row);
  }
  return next.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

async function send(c: Connection, ops: SheetOp[]) {
  await pushSheet(c, ops);
  const key = [...KEY, c.url];
  await mutate<SheetData>(
    key,
    (d) => {
      if (!d) return d;
      const next = { ...d, rows: applyOps(d.rows, ops) };
      writeCache(next);
      return next;
    },
    { revalidate: false },
  );
  // 시트 쪽 정렬·다른 변경까지 맞추려고 뒤에서 다시 받는다
  mutate(key);
}

export const addRecords = (c: Connection, drafts: RecordDraft[]) => send(c, drafts.map((d) => ({ op: "add", row: toSheetRow(d) })));
export const updateRecord = (c: Connection, r: MoneyRecord, d: RecordDraft) => send(c, [{ op: "update", match: r.key, row: toSheetRow(d) }]);
export const deleteRecord = (c: Connection, r: MoneyRecord) => send(c, [{ op: "delete", match: r.key }]);

/** 화면에서 쓰는 기록 목록 + 시트 설정 */
export function useData() {
  const sheet = useSheet();
  const records = useMemo(() => (sheet.data ? toRecords(sheet.data.rows) : undefined), [sheet.data]);
  return { ...sheet, records, settings: sheet.data?.settings, rules: sheet.data?.rules ?? [] };
}

/**
 * 뱅크샐러드 가져오기 저장: (자산 현황이 있으면) 계좌 목록 통째로 바꾸기 → 기록 추가 → 새 규칙 저장 → 다시 받기.
 * 계좌 이름이 바뀌면 이번에 넣는 기록과 규칙의 계좌 이름도 같이 바꾼다.
 */
export async function saveImport(c: Connection, input: { drafts: RecordDraft[]; rules: Rule[]; reset?: ResetPlan }) {
  const rename = new Map((input.reset?.renames ?? []).map((r) => [r.from, r.to]));
  const re = (n?: string) => (n && rename.get(n)) || n;
  if (input.reset) {
    await replaceAccounts(
      c,
      input.reset.accounts.map(({ kind, category, subcategory, name, start, memo, hidden }) => ({ kind, category, subcategory, name, start, memo, hidden })),
      input.reset.renames,
    );
  }
  const drafts = input.drafts.map((d) => ({ ...d, inAccount: re(d.inAccount), outAccount: re(d.outAccount) }));
  if (drafts.length) await pushSheet(c, drafts.map((d) => ({ op: "add", row: toSheetRow(d) })));
  const rules = input.rules.map((r) => (r.type === "계좌" ? { ...r, category: re(r.category)! } : r));
  if (rules.length) await saveRules(c, rules);
  await mutate([...KEY, c.url]);
}

export async function removeRule(c: Connection, rule: Pick<Rule, "type" | "source">) {
  await saveRules(c, [{ type: rule.type, source: rule.source, remove: true }]);
  await mutate([...KEY, c.url]);
}
