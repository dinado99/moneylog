"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { mutate } from "swr";
import { currentMonth } from "@/lib/format";
import { supabase, supabaseConfigured } from "@/lib/supabase";
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

const noopSubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** undefined = 확인 중, null = 로그아웃 상태 */
function useAuthSession(enabled: boolean): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    const { data } = supabase().auth.onAuthStateChange((event, s) => {
      setSession(s);
      // 다른 계정으로 바뀌면 이전 계정 캐시를 비운다
      if (event === "SIGNED_OUT") mutate(() => true, undefined, { revalidate: false });
    });
    return () => data.subscription.unsubscribe();
  }, [enabled]);
  return session;
}

function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth);
  return <MonthContext.Provider value={{ month, setMonth }}>{children}</MonthContext.Provider>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const session = useAuthSession(mounted && supabaseConfigured);

  if (!mounted) return null;
  if (!supabaseConfigured) return <SetupNotice />;
  if (session === undefined) return null;
  if (session === null) return <LoginScreen />;

  return (
    <SessionContext.Provider value={session}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <main className="pt-safe flex-1 pb-28">
          <MonthProvider>{children}</MonthProvider>
        </main>
        <TabBar />
      </div>
    </SessionContext.Provider>
  );
}

function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="text-[20px] font-bold">Supabase 연결이 필요해요</p>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
        환경 변수 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 설정한 뒤 다시 배포해 주세요.
      </p>
    </div>
  );
}
