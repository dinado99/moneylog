"use client";

import { useState } from "react";
import { setConnection } from "@/lib/connection";
import { formatNumber, splitEmoji } from "@/lib/format";
import { clearCache, useSheet } from "@/lib/store";
import type { SheetSettings } from "@/lib/types";
import { ConnectForm } from "../connect-form";
import { Card, PageHeader } from "../ui";

export function SettingsScreen() {
  const { data, isValidating, error, mutate } = useSheet();
  return (
    <>
      <PageHeader title="설정" />
      <ConnectForm />
      <Card className="mt-3 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="min-w-0">
            <p className="text-[15px] font-medium">시트에서 새로 받기</p>
            <p className={`mt-0.5 text-[12px] ${error ? "text-danger" : "text-ink-3"}`}>
              {error
                ? error.message
                : data
                  ? `마지막으로 받음 ${new Date(data.fetchedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })} · 기록 ${formatNumber(data.rows.length)}줄`
                  : "아직 받지 않았어요"}
            </p>
          </div>
          <button
            disabled={isValidating}
            onClick={() => mutate()}
            className="h-9 shrink-0 rounded-full bg-surface-2 px-4 text-[14px] font-medium disabled:opacity-50"
          >
            {isValidating ? "받는 중" : "새로 받기"}
          </button>
        </div>
      </Card>
      {data && <SheetData settings={data.settings} />}
      <Card className="mt-3 overflow-hidden">
        <button
          onClick={() => {
            if (!confirm("이 휴대폰에서 시트 연결을 끊을까요? 시트의 내용은 그대로 남아요.")) return;
            clearCache();
            setConnection(null);
          }}
          className="h-14 w-full px-5 text-left text-[15px] text-danger active:bg-surface-2"
        >
          이 휴대폰에서 연결 끊기
        </button>
      </Card>
    </>
  );
}

function SheetData({ settings }: { settings: SheetSettings }) {
  const [open, setOpen] = useState<string | null>(null);
  const sections = [
    { key: "지출", title: "지출 분류", items: settings.categories.filter((c) => c.kind === "지출") },
    { key: "수입", title: "수입 분류", items: settings.categories.filter((c) => c.kind === "수입") },
  ];
  return (
    <Card className="mt-3 overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <p className="text-[16px] font-semibold">시트 &apos;가계부 설정&apos;</p>
        <p className="mt-1 text-[13px] text-ink-3">
          시트에서 고치면 앱에도 반영돼요.{settings.startYear ? ` 시작 ${settings.startYear}년 · 회계기준월 ${settings.fiscalMonth}월` : ""}
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
                  <p key={c.name} className="text-[14px]">
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
            {settings.accounts.map((a, i) => (
              <p key={i} className="flex justify-between text-[14px]">
                <span className="min-w-0 truncate">
                  {a.name} <span className="text-[12px] text-ink-3">{[a.category, a.subcategory].filter(Boolean).join(" › ")}</span>
                </span>
                <span className="num shrink-0 text-ink-3">{formatNumber(a.start)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
