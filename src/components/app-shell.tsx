"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { useConnection } from "@/lib/connection";
import { currentMonth } from "@/lib/format";
import { ConnectForm } from "./connect-form";
import { TabBar } from "./tab-bar";

const MonthContext = createContext<{ month: string; setMonth: (m: string) => void } | null>(null);

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used inside AppShell");
  return ctx;
}

const noop = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** 오늘 날짜는 브라우저에서만 읽는다 (미리 그리는 단계에서 읽으면 안 됨) */
function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth);
  return <MonthContext.Provider value={{ month, setMonth }}>{children}</MonthContext.Provider>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const conn = useConnection();
  if (!mounted) return null;
  if (!conn) {
    return (
      <div className="flex min-h-dvh flex-col justify-center py-10">
        <div className="px-6 pb-6">
          <p className="text-[26px] leading-snug font-bold">
            머니로그
            <span className="block text-[16px] font-medium text-ink-3">낼나 가계부를 휴대폰에서</span>
          </p>
        </div>
        <ConnectForm />
      </div>
    );
  }
  return (
    <MonthProvider>
      <main className="pb-28">{children}</main>
      <TabBar />
    </MonthProvider>
  );
}
