"use client";

import { useSyncExternalStore } from "react";
import type { Settings } from "./db";
import { fullSync, pushPending, type SyncResult } from "./run-sync";
import { SheetError } from "./sheet";

type State = { status: "idle" | "syncing" | "error"; message?: string; result?: SyncResult };

let state: State = { status: "idle" };
const listeners = new Set<() => void>();
const set = (s: State) => {
  state = s;
  listeners.forEach((l) => l());
};

export function useSyncState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

let running: Promise<unknown> | null = null;

async function run<T>(job: () => Promise<T>): Promise<T | undefined> {
  // 동시에 두 번 돌지 않게 앞의 작업이 끝날 때까지 기다린다
  while (running) await running.catch(() => {});
  set({ status: "syncing" });
  const p = job();
  running = p;
  try {
    const out = await p;
    set({ status: "idle", result: typeof out === "object" ? (out as SyncResult) : state.result });
    return out;
  } catch (e) {
    set({ status: "error", message: e instanceof SheetError ? e.message : "동기화하지 못했어요. 잠시 후 다시 시도해 주세요." });
    console.error(e);
  } finally {
    running = null;
  }
}

export const syncAll = (s: Settings) => run(() => fullSync(s));

/** 저장 직후 시트로 보내기. 시트가 연결 안 돼 있으면 조용히 넘어간다(나중에 동기화). */
export const syncPush = (s: Settings) => {
  if (!s.config.sheetUrl || !s.config.sheetToken) return;
  return run(() => pushPending(s));
};
