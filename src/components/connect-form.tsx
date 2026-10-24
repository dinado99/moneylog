"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { setConnection, useConnection } from "@/lib/connection";
import { formatNumber } from "@/lib/format";
import { pullSheet, SheetError } from "@/lib/sheet";
import { clearCache } from "@/lib/store";
import { Button, Card, TextInput } from "./ui";

/** 구글 시트 웹 앱 URL·비밀번호 입력. 처음 화면과 설정에서 같이 쓴다. */
export function ConnectForm() {
  const conn = useConnection();
  const [url, setUrl] = useState(conn?.url ?? "");
  const [token, setToken] = useState(conn?.token ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [guide, setGuide] = useState(!conn);
  const [copied, setCopied] = useState(false);

  async function connect() {
    setBusy(true);
    setMessage(null);
    const next = { url: url.trim(), token: token.trim() };
    try {
      const { records, settings } = await pullSheet(next);
      if (conn?.url !== next.url) clearCache();
      setConnection(next);
      setMessage({ text: `연결됐어요. 기록 ${formatNumber(records.length)}줄, 분류 ${settings.categories.length}개, 계좌 ${settings.accounts.length}개를 찾았어요.` });
    } catch (e) {
      setMessage({ text: e instanceof SheetError ? e.message : "연결하지 못했어요.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function copyScript() {
    const text = await (await fetch("/apps-script/Code.gs")).text();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[16px] font-semibold">구글 시트 연결</p>
        {conn && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">연결됨</span>}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
        내역은 낼나 가계부 구글 시트에만 저장돼요. 앱에서 입력하면 &apos;가계부 기록&apos;에 바로 들어가고, PC에서 고친 내용은 앱을 열 때 보여요.
      </p>

      <button onClick={() => setGuide(!guide)} className="mt-4 flex items-center gap-1 text-[14px] font-medium text-accent">
        연결 방법 <ChevronDown size={16} className={guide ? "rotate-180" : ""} />
      </button>
      {guide && (
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-2">
          <li>
            <button onClick={copyScript} className="inline-flex items-center gap-1 font-semibold text-accent">
              {copied ? <Check size={14} /> : <Copy size={14} />} 스크립트 복사
            </button>
          </li>
          <li>PC에서 낼나 가계부 시트를 열고 메뉴 확장 프로그램 › Apps Script</li>
          <li>원래 있던 내용을 지우고 붙여넣기</li>
          <li>
            맨 위 <code className="rounded bg-surface-2 px-1">TOKEN</code>의 &apos;여기에-비밀번호를-적어주세요&apos;를 원하는 비밀번호로 바꾸고 저장
          </li>
          <li>배포 › 새 배포 › 톱니바퀴에서 &apos;웹 앱&apos; › 실행: 나, 액세스: 모든 사용자 › 배포 (처음엔 권한 허용 필요)</li>
          <li>나온 웹 앱 URL과 비밀번호를 아래에 입력</li>
        </ol>
      )}

      <div className="mt-4 space-y-2">
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="웹 앱 URL (https://script.google.com/...)" className="w-full text-[14px]" />
        <TextInput type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="스크립트에 적은 비밀번호" className="w-full" />
      </div>
      {message && <p className={`mt-3 text-[13px] ${message.error ? "text-danger" : "text-ink-2"}`}>{message.text}</p>}
      <Button className="mt-4 w-full" disabled={busy || !url.trim() || !token.trim()} onClick={connect}>
        {busy ? "확인 중…" : conn ? "다시 연결" : "연결하기"}
      </Button>
    </Card>
  );
}
