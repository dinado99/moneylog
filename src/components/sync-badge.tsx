"use client";

import Link from "next/link";
import { CloudAlert, CloudCheck, RefreshCw } from "lucide-react";
import { useSettings } from "@/lib/hooks";
import { syncAll, useSyncState } from "@/lib/sync-store";

/** 헤더 오른쪽: 동기화 상태. 누르면 바로 동기화 */
export function SyncBadge() {
  const { data: settings } = useSettings();
  const sync = useSyncState();
  if (!settings) return null;
  if (!settings.config.sheetUrl) {
    return (
      <Link href="/settings" className="flex h-8 items-center gap-1 rounded-full bg-accent-soft px-3 text-[12px] font-semibold text-accent">
        시트 연결하기
      </Link>
    );
  }
  const busy = sync.status === "syncing";
  return (
    <button
      onClick={() => !busy && syncAll(settings)}
      aria-label="지금 동기화"
      className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium ${
        sync.status === "error" ? "bg-danger/10 text-danger" : "bg-surface text-ink-3"
      }`}
    >
      {busy ? <RefreshCw size={14} className="animate-spin" /> : sync.status === "error" ? <CloudAlert size={14} /> : <CloudCheck size={14} />}
      {busy ? "동기화 중" : sync.status === "error" ? "동기화 실패" : "시트와 맞춤"}
    </button>
  );
}
