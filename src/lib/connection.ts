"use client";

import { useSyncExternalStore } from "react";
import type { Connection } from "./sheet";

// 시트 연결 정보는 이 휴대폰(브라우저)에만 저장한다
const KEY = "moneylog:connection";
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: Connection | null } = { raw: null, value: null };

function read(): Connection | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cached.raw) {
    let value: Connection | null = null;
    try {
      value = raw ? (JSON.parse(raw) as Connection) : null;
    } catch {}
    cached = { raw, value };
  }
  return cached.value;
}

export function setConnection(c: Connection | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

export function useConnection(): Connection | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => null,
  );
}
