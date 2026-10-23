"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { ChevronRight } from "lucide-react";
import { allTxns, countTxns, deleteAllTxns, restoreTxns } from "@/lib/db";
import { formatNumber, todayString } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Txn } from "@/lib/types";
import { useSession } from "../app-shell";
import { Card, PageHeader } from "../ui";

export function SettingsScreen() {
  const session = useSession();
  const { data: count } = useSWR(["txns", "count"], countTxns);
  const [message, setMessage] = useState<string | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  async function attempt(action: () => Promise<string>) {
    try {
      setMessage(await action());
    } catch {
      setMessage("처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  const exportBackup = () =>
    attempt(async () => {
      const txns = await allTxns();
      const blob = new Blob([JSON.stringify({ version: 1, txns }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `moneylog-${todayString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return `${formatNumber(txns.length)}건을 내보냈어요.`;
    });

  const restore = (file: File | undefined) =>
    file &&
    attempt(async () => {
      let txns: Txn[];
      try {
        const data = JSON.parse(await file.text()) as { txns?: Txn[] };
        if (!Array.isArray(data.txns)) throw new Error();
        txns = data.txns;
      } catch {
        return "백업 파일을 읽지 못했어요.";
      }
      const added = await restoreTxns(txns);
      return `${formatNumber(added)}건을 복원했어요.${txns.length > added ? ` (이미 있는 ${formatNumber(txns.length - added)}건 제외)` : ""}`;
    });

  const wipe = () => {
    if (!confirm("모든 내역을 삭제할까요? 되돌릴 수 없어요.")) return;
    attempt(async () => {
      await deleteAllTxns();
      return "모든 내역을 삭제했어요.";
    });
  };

  return (
    <>
      <PageHeader title="설정" />
      {message && <p className="mx-4 mb-3 rounded-2xl bg-surface px-4 py-3 text-[14px] text-ink-2">{message}</p>}

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <p className="text-[13px] text-ink-3">저장된 내역</p>
          <p className="num mt-1 text-[22px] font-bold">{count === undefined ? "–" : `${formatNumber(count)}건`}</p>
        </div>
        <Row label="백업 파일 내보내기" onClick={exportBackup} />
        <Row label="백업에서 복원" onClick={() => restoreInput.current?.click()} />
        <Row label="모든 내역 삭제" danger onClick={wipe} />
      </Card>

      <Card className="mt-3 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <p className="text-[13px] text-ink-3">계정</p>
          <p className="mt-1 truncate text-[16px] font-medium">{session.user.email}</p>
        </div>
        <Row label="로그아웃" onClick={() => supabase().auth.signOut()} />
      </Card>

      <input
        ref={restoreInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          restore(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

function Row({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-14 w-full items-center justify-between border-t border-line px-5 text-[15px] active:bg-surface-2 ${
        danger ? "text-danger" : ""
      }`}
    >
      {label}
      <ChevronRight size={18} className="text-ink-3" />
    </button>
  );
}
