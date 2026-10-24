"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { saveConfig, type Settings } from "@/lib/db";
import { formatNumber, splitEmoji } from "@/lib/format";
import { useSettings } from "@/lib/hooks";
import { pullSheet, SheetError } from "@/lib/sheet";
import { supabase } from "@/lib/supabase";
import { syncAll, useSyncState } from "@/lib/sync-store";
import { useSession } from "../app-shell";
import { Button, Card, LoadError, PageHeader, TextInput } from "../ui";

export function SettingsScreen() {
  const { data: settings, error } = useSettings();
  const session = useSession();
  if (error) return <LoadError />;
  if (!settings) return null;
  return (
    <>
      <PageHeader title="설정" />
      <SheetCard settings={settings} />
      <SheetData settings={settings} />
      <Card className="mt-3 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <p className="text-[13px] text-ink-3">계정</p>
          <p className="mt-1 truncate text-[16px] font-medium">{session.user.email}</p>
        </div>
        <button onClick={() => supabase().auth.signOut()} className="h-14 w-full border-t border-line px-5 text-left text-[15px] active:bg-surface-2">
          로그아웃
        </button>
      </Card>
    </>
  );
}

function SheetCard({ settings }: { settings: Settings }) {
  const [url, setUrl] = useState(settings.config.sheetUrl ?? "");
  const [token, setToken] = useState(settings.config.sheetToken ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [guide, setGuide] = useState(!settings.config.sheetUrl);
  const [copied, setCopied] = useState(false);
  const sync = useSyncState();
  const connected = !!settings.config.sheetUrl;

  async function connect() {
    setBusy(true);
    setMessage(null);
    try {
      const { records, settings: s } = await pullSheet(url.trim(), token.trim());
      await saveConfig({ sheet_url: url.trim(), sheet_token: token.trim() });
      setMessage({ text: `연결됐어요. 기록 ${formatNumber(records.length)}줄, 분류 ${s.categories.length}개, 계좌 ${s.accounts.length}개를 찾았어요.` });
      await syncAll({ ...settings, config: { ...settings.config, sheetUrl: url.trim(), sheetToken: token.trim() } });
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
        {connected && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">연결됨</span>}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
        앱에서 입력하면 낼나 가계부 &apos;가계부 기록&apos;에 바로 들어가고, PC에서 시트를 고치면 앱을 열 때 반영돼요. 분류·계좌는 시트 &apos;가계부 설정&apos;을
        따라요.
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
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" disabled={busy || !url.trim() || !token.trim()} onClick={connect}>
          {busy ? "확인 중…" : connected ? "다시 연결" : "연결하기"}
        </Button>
        {connected && (
          <Button variant="secondary" disabled={sync.status === "syncing"} onClick={() => syncAll(settings)}>
            {sync.status === "syncing" ? "동기화 중" : "지금 동기화"}
          </Button>
        )}
      </div>
      {connected && (
        <p className="mt-3 text-[12px] text-ink-3">
          {sync.status === "error" ? (
            <span className="text-danger">{sync.message}</span>
          ) : settings.config.lastSync ? (
            `마지막 동기화 ${new Date(settings.config.lastSync).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}`
          ) : (
            "아직 동기화 전이에요"
          )}
          {sync.result && sync.status === "idle" && ` · 보냄 ${sync.result.pushed} · 받음 ${sync.result.added} · 지움 ${sync.result.removed}`}
        </p>
      )}
    </Card>
  );
}

function SheetData({ settings }: { settings: Settings }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!settings.categories.length && !settings.accounts.length) return null;
  const sections = [
    { key: "지출", title: "지출 분류", items: settings.categories.filter((c) => c.kind === "지출") },
    { key: "수입", title: "수입 분류", items: settings.categories.filter((c) => c.kind === "수입") },
  ];
  return (
    <Card className="mt-3 overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <p className="text-[16px] font-semibold">시트에서 가져온 설정</p>
        <p className="mt-1 text-[13px] text-ink-3">
          시트 &apos;가계부 설정&apos;에서 고치고 동기화하면 반영돼요. {settings.config.startYear && `시작 ${settings.config.startYear}년 · 회계기준월 ${settings.config.fiscalMonth}월`}
        </p>
      </div>
      {sections.map((s) => (
        <div key={s.key} className="border-t border-line">
          <button onClick={() => setOpen(open === s.key ? null : s.key)} className="flex h-13 w-full items-center justify-between px-5 text-[15px]">
            {s.title} <span className="text-[13px] text-ink-3">{s.items.length}개</span>
          </button>
          {open === s.key && (
            <div className="space-y-2 px-5 pb-4">
              {s.items.map((c) => {
                const { emoji, label } = splitEmoji(c.name);
                return (
                  <p key={c.id} className="text-[14px]">
                    {emoji} {label}
                    <span className="ml-1 text-[13px] text-ink-3">{c.subs.map((x) => x.name + (x.fixed ? "(고정)" : "")).join(", ")}</span>
                  </p>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <div className="border-t border-line">
        <button onClick={() => setOpen(open === "acc" ? null : "acc")} className="flex h-13 w-full items-center justify-between px-5 text-[15px]">
          계좌 · 자산 <span className="text-[13px] text-ink-3">{new Set(settings.accounts.map((a) => a.name)).size}개</span>
        </button>
        {open === "acc" && (
          <div className="space-y-1.5 px-5 pb-4">
            {settings.accounts.map((a) => (
              <p key={a.id} className="flex justify-between text-[14px]">
                <span className="min-w-0 truncate">
                  {a.name} <span className="text-[12px] text-ink-3">{[a.category, a.subcategory].filter(Boolean).join(" › ")}</span>
                </span>
                <span className="num shrink-0 text-ink-3">{formatNumber(a.startAmount)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
