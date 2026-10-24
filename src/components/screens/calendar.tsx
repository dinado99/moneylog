"use client";

import { useMemo, useState } from "react";
import { scheduleDay, sumKind } from "@/lib/analytics";
import { shortWon } from "@/lib/chart";
import { useConnection } from "@/lib/connection";
import { formatDayHeader, formatNumber, todayString } from "@/lib/format";
import { deleteRecord, updateRecord, useData } from "@/lib/store";
import type { MoneyRecord } from "@/lib/types";
import { useMonth } from "../app-shell";
import { MonthSwitcher } from "../month-switcher";
import { RecordRow } from "../record-row";
import { RecordSheet } from "../record-sheet";
import { SyncBadge } from "../sync-badge";
import { Card, PageHeader } from "../ui";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export function CalendarScreen() {
  const { month } = useMonth();
  const conn = useConnection()!;
  const { records, settings } = useData();
  const [selected, setSelected] = useState<number | null>(() => (todayString().startsWith(month) ? Number(todayString().slice(8)) : null));
  const [editing, setEditing] = useState<MoneyRecord | null>(null);

  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const last = new Date(y, m, 0).getDate();

  const { byDay, list } = useMemo(() => {
    const list = (records ?? []).filter((r) => r.date.startsWith(month));
    const byDay = new Map<number, MoneyRecord[]>();
    for (const r of list) {
      const d = Number(r.date.slice(8));
      byDay.set(d, [...(byDay.get(d) ?? []), r]);
    }
    return { byDay, list };
  }, [records, month]);

  const events = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const s of settings?.schedules ?? []) {
      const d = scheduleDay(s.day, s.weekend, month);
      if (d) map.set(d, [...(map.get(d) ?? []), s.name]);
    }
    return map;
  }, [settings, month]);

  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const today = todayString();
  const income = sumKind(list, "수입");
  const expense = sumKind(list, "지출");
  const sel = selected ? (byDay.get(selected) ?? []) : [];
  const selDate = selected ? `${month}-${String(selected).padStart(2, "0")}` : null;

  return (
    <>
      <PageHeader title={<MonthSwitcher />} right={<SyncBadge />} />
      <div className="mx-4 mb-3 grid grid-cols-3 rounded-3xl bg-surface py-4 text-center">
        <div>
          <p className="text-[12px] text-ink-3">총수입</p>
          <p className="num mt-1 text-[16px] font-bold text-income">{formatNumber(income)}</p>
        </div>
        <div className="border-x border-line">
          <p className="text-[12px] text-ink-3">총지출</p>
          <p className="num mt-1 text-[16px] font-bold">{formatNumber(expense)}</p>
        </div>
        <div>
          <p className="text-[12px] text-ink-3">순수입</p>
          <p className={`num mt-1 text-[16px] font-bold ${income - expense < 0 ? "text-danger" : ""}`}>{formatNumber(income - expense)}</p>
        </div>
      </div>

      <section className="mx-4 rounded-3xl bg-surface px-2.5 py-4">
        <div className="grid grid-cols-7 text-center">
          {WEEK.map((w, i) => (
            <div key={w} className={`pb-2 text-[11px] ${i === 0 ? "text-danger" : i === 6 ? "text-accent" : "text-ink-3"}`}>
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const items = byDay.get(d) ?? [];
            const inc = sumKind(items, "수입");
            const exp = sumKind(items, "지출");
            const ev = events.get(d) ?? [];
            const date = `${month}-${String(d).padStart(2, "0")}`;
            const isSel = d === selected;
            const wd = (first + d - 1) % 7;
            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                className={`flex h-[64px] flex-col items-center gap-px rounded-xl pt-1 ${isSel ? "bg-ink text-surface" : "active:bg-surface-2"}`}
              >
                <span
                  className={`text-[12px] font-semibold ${
                    !isSel && date === today ? "rounded-full bg-accent-soft px-1.5 text-accent" : !isSel && wd === 0 ? "text-danger" : !isSel && wd === 6 ? "text-accent" : ""
                  }`}
                >
                  {d}
                </span>
                {inc > 0 && <span className={`num text-[10px] leading-tight ${isSel ? "" : "text-income"}`}>+{shortWon(inc)}</span>}
                {exp > 0 && <span className={`num text-[10px] leading-tight ${isSel ? "" : "text-ink-2"}`}>−{shortWon(exp)}</span>}
                {ev.length > 0 && <span className={`mt-auto mb-1 size-[5px] rounded-full ${isSel ? "bg-surface" : "bg-[var(--series-2)]"}`} />}
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className="mx-4 mt-3 rounded-3xl bg-surface py-2">
          <div className="flex items-center justify-between px-5 pt-2 pb-1">
            <span className="text-[15px] font-semibold">{formatDayHeader(selDate!)}</span>
            <span className="num text-[13px] text-ink-3">
              {sumKind(sel, "수입") > 0 && <span className="text-income">+{formatNumber(sumKind(sel, "수입"))} </span>}
              {sumKind(sel, "지출") > 0 && `−${formatNumber(sumKind(sel, "지출"))}`}
            </span>
          </div>
          {(events.get(selected) ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-5 py-2">
              {events.get(selected)!.map((n) => (
                <span key={n} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2">
                  📌 {n}
                </span>
              ))}
            </div>
          )}
          {sel.length ? sel.map((r) => <RecordRow key={r.id} r={r} onClick={() => setEditing(r)} />) : <p className="px-5 py-5 text-center text-[14px] text-ink-3">이날은 내역이 없어요</p>}
        </section>
      )}

      <Card className="mt-3 py-2">
        <p className="px-5 pt-3 pb-1 text-[16px] font-semibold">주간 합계</p>
        {weeks.map((w, i) => {
          const days = w.filter((d): d is number => d !== null);
          const items = days.flatMap((d) => byDay.get(d) ?? []);
          const inc = sumKind(items, "수입");
          const exp = sumKind(items, "지출");
          return (
            <div key={i} className="flex items-center gap-3 px-5 py-2.5 text-[14px]">
              <span className="w-12 shrink-0 font-medium">{i + 1}주차</span>
              <span className="num flex-1 text-[12px] text-ink-3">
                {days[0]}~{days.at(-1)}일
              </span>
              <span className="num w-24 text-right text-income">{inc ? `+${formatNumber(inc)}` : "–"}</span>
              <span className="num w-24 text-right">{exp ? `−${formatNumber(exp)}` : "–"}</span>
            </div>
          );
        })}
      </Card>

      {settings && settings.schedules.length > 0 && (
        <Card className="mt-3 py-2">
          <p className="px-5 pt-3 pb-1 text-[16px] font-semibold">정기 일정</p>
          {settings.schedules.map((s) => {
            const d = scheduleDay(s.day, s.weekend, month);
            return (
              <div key={s.name} className="flex items-center justify-between px-5 py-2 text-[14px]">
                <span>📌 {s.name}</span>
                <span className="text-[13px] text-ink-3">
                  매달 {s.day}일{s.weekend ? ` · 주말이면 ${s.weekend}` : ""}
                  {d && d !== s.day ? ` → 이번 달 ${d}일` : ""}
                </span>
              </div>
            );
          })}
          <p className="px-5 pb-3 text-[12px] text-ink-3">시트 &apos;수입·지출 달력&apos;에서 바꿀 수 있어요.</p>
        </Card>
      )}

      <RecordSheet
        open={editing !== null}
        settings={settings}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSave={(d) => updateRecord(conn, editing!, d)}
        onDelete={() => deleteRecord(conn, editing!)}
      />
    </>
  );
}
