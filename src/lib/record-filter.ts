"use client";

import { useSyncExternalStore } from "react";
import type { Account, RecordDraft } from "./types";

/** 내역 화면의 계좌 필터: 전체 / 자산·부채 대분류(💰 현금·예금, 💳 신용카드 …) / 계좌 하나 */
export type RecordFilter = { category?: string; account?: string };

let current: RecordFilter = {};
const listeners = new Set<() => void>();

export function setRecordFilter(f: RecordFilter) {
  current = f;
  listeners.forEach((l) => l());
}

export function useRecordFilter(): RecordFilter {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}

/** 대분류 목록 (시트 계좌표 순서, 자산 먼저)과 대분류별 계좌 이름 */
export function accountGroups(accounts: Account[]): { category: string; kind: "자산" | "부채"; names: string[] }[] {
  const out: { category: string; kind: "자산" | "부채"; names: string[] }[] = [];
  const sorted = [...accounts].sort((a, b) => (a.kind === b.kind ? (a.sort || 0) - (b.sort || 0) : a.kind === "자산" ? -1 : 1));
  for (const a of sorted) {
    if (!a.category) continue;
    let g = out.find((x) => x.category === a.category);
    if (!g) out.push((g = { category: a.category, kind: a.kind, names: [] }));
    if (!g.names.includes(a.name)) g.names.push(a.name);
  }
  return out;
}

/** 필터에 걸리는 계좌 이름 (null = 전체) */
export function filterNames(f: RecordFilter, accounts: Account[]): Set<string> | null {
  if (f.account) return new Set([f.account]);
  if (f.category) return new Set(accounts.filter((a) => a.category === f.category).map((a) => a.name));
  return null;
}

export function matchesFilter(r: RecordDraft, names: Set<string> | null): boolean {
  if (!names) return true;
  return (!!r.inAccount && names.has(r.inAccount)) || (!!r.outAccount && names.has(r.outAccount));
}
