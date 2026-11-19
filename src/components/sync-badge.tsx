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

/** 시트 연결이 실패하면 이유를 화면 위에 보여 준다 (예전에 받아 둔 내용은 보이지만 저장은 안 되는 상태) */
export function SyncError() {
  const { isValidating, error, data } = useSheet();
  if (!error || isValidating || !data) return null;
  return (
    <p className="mx-4 mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-[13px] leading-relaxed text-danger">
      시트에 연결하지 못했어요: {error instanceof Error ? error.message : String(error)}
      <span className="block text-danger/80">지금 보이는 건 예전에 받아 둔 내용이라 저장도 안 될 수 있어요.</span>
    </p>
  );
}
