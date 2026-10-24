"use client";

import { CloudAlert, CloudCheck, RefreshCw } from "lucide-react";
import { useSheet } from "@/lib/store";

/** 헤더 오른쪽: 시트에서 받아 오는 중 / 실패. 누르면 다시 받기 */
export function SyncBadge() {
  const { isValidating, error, mutate } = useSheet();
  return (
    <button
      onClick={() => !isValidating && mutate()}
      aria-label="시트에서 새로 받기"
      className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium ${error && !isValidating ? "bg-danger/10 text-danger" : "bg-surface text-ink-3"}`}
    >
      {isValidating ? <RefreshCw size={14} className="animate-spin" /> : error ? <CloudAlert size={14} /> : <CloudCheck size={14} />}
      {isValidating ? "시트 확인 중" : error ? "연결 실패" : "시트와 같음"}
    </button>
  );
}
