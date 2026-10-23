"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { currentMonth } from "@/lib/format";
import { TabBar } from "./tab-bar";

const MonthContext = createContext<{ month: string; setMonth: (m: string) => void } | null>(null);

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used inside AppShell");
  return ctx;
}

const noopSubscribe = () => () => {};

/** 데이터가 전부 기기(IndexedDB)에 있으므로 화면은 브라우저에서만 그린다. */
function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth);
  return <MonthContext.Provider value={{ month, setMonth }}>{children}</MonthContext.Provider>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="pt-safe flex-1 pb-28">{mounted ? <MonthProvider>{children}</MonthProvider> : null}</main>
      <TabBar />
    </div>
  );
}
