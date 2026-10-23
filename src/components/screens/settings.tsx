"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { formatNumber, todayString } from "@/lib/format";
import { getPasscode, setPasscode } from "@/lib/passcode";
import type { Txn } from "@/lib/types";
import { Card, PageHeader } from "../ui";

export function SettingsScreen() {
  const count = useLiveQuery(() => db.txns.count(), []);
  const [code, setCode] = useState(getPasscode);
  const [message, setMessage] = useState<string | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  async function exportBackup() {
    const txns = await db.txns.toArray();
    const blob = new Blob([JSON.stringify({ version: 1, txns }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moneylog-${todayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { txns?: Txn[] };
      if (!Array.isArray(data.txns)) throw new Error();
      await db.txns.bulkPut(data.txns);
      setMessage(`${formatNumber(data.txns.length)}건을 복원했어요.`);
    } catch {
      setMessage("백업 파일을 읽지 못했어요.");
    }
  }

  async function wipe() {
    if (!confirm("모든 내역을 삭제할까요? 되돌릴 수 없어요.")) return;
    await db.txns.clear();
    setMessage("모든 내역을 삭제했어요.");
  }

  return (
    <>
      <PageHeader title="설정" />
      {message && <p className="mx-4 mb-3 rounded-2xl bg-surface px-4 py-3 text-[14px] text-ink-2">{message}</p>}

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <p className="text-[13px] text-ink-3">저장된 내역</p>
          <p className="num mt-1 text-[22px] font-bold">{formatNumber(count ?? 0)}건</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
            내역은 이 기기의 브라우저에만 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 백업해 두세요.
          </p>
        </div>
        <Row label="백업 파일 내보내기" onClick={exportBackup} />
        <Row label="백업에서 복원" onClick={() => restoreInput.current?.click()} />
        <Row label="모든 내역 삭제" danger onClick={wipe} />
      </Card>

      <Card className="mt-3 p-5">
        <p className="text-[15px] font-semibold">캡처 분석 패스코드</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
          서버에 APP_PASSCODE를 설정했다면 같은 값을 입력하세요.
        </p>
        <input
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setPasscode(e.target.value);
          }}
          placeholder="패스코드"
          className="mt-3 h-11 w-full rounded-xl bg-surface-2 px-4 outline-none placeholder:text-ink-3"
        />
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
