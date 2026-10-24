"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { mutate } from "swr";
import { currentMonth } from "@/lib/format";
import { useSettings } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { syncAll } from "@/lib/sync-store";
import { LoginScreen } from "./screens/login";
import { TabBar } from "./tab-bar";

const MonthContext = createContext<{ month: string; setMonth: (m: string) => void } | null>(null);
const SessionContext = createContext<Session | null>(null);

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used inside AppShell");
  return ctx;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession must be used after login");
  return s;
}

const noop = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** undefined = 확인 중, null = 로그아웃 */
function useAuthSession(enabled: boolean) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    const { data } = supabase().auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") mutate(() => true, undefined, { revalidate: false });
    });
    return () => data.subscription.unsubscribe();
  }, [enabled]);
  return session;
}

/** 앱을 열 때, 그리고 다시 앱으로 돌아올 때 시트와 맞춘다. */
function AutoSync() {
  const { data: settings } = useSettings();
  const last = useRef(0);
  useEffect(() => {
    if (!settings?.config.sheetUrl) return;
    const go = () => {
      if (Date.now() - last.current < 60_000) return;
      last.current = Date.now();
      syncAll(settings);
    };
    go();
    const onVisible = () => document.visibilityState === "visible" && go();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [settings]);
  return null;
}

function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth);
  return <MonthContext.Provider value={{ month, setMonth }}>{children}</MonthContext.Provider>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const session = useAuthSession(mounted);
  if (!mounted || session === undefined) return null;
  if (session === null) return <LoginScreen />;
  return (
    <SessionContext.Provider value={session}>
      <AutoSync />
      <MonthProvider>
        <main className="pb-28">{children}</main>
      </MonthProvider>
      <TabBar />
    </SessionContext.Provider>
  );
}
