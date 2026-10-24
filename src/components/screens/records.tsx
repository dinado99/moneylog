"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { addRecords, deleteRecord, updateRecord } from "@/lib/db";
import { formatDayHeader, formatNumber } from "@/lib/format";
import { useMonthRecords, useSettings } from "@/lib/hooks";
import { syncPush } from "@/lib/sync-store";
import type { MoneyRecord } from "@/lib/types";
import { useMonth } from "../app-shell";
import { MonthSwitcher } from "../month-switcher";
import { RecordRow } from "../record-row";
import { RecordSheet } from "../record-sheet";
import { SyncBadge } from "../sync-badge";
import { LoadError, PageHeader } from "../ui";

export function RecordsScreen() {
  const { month } = useMonth();
  const { data: records, error } = useMonthRecords(month);
  const { data: settings } = useSettings();
  const [editing, setEditing] = useState<MoneyRecord | "new" | null>(null);

  const { groups, income, expense } = useMemo(() => {
    const map = new Map<string, MoneyRecord[]>();
    let income = 0;
    let expense = 0;
    for (const r of records ?? []) {
      map.set(r.date, [...(map.get(r.date) ?? []), r]);
      if (r.kind === "수입") income += r.amount;
      if (r.kind === "지출") expense += r.amount;
    }
    return { groups: [...map.entries()], income, expense };
  }, [records]);

  const afterChange = () => settings && syncPush(settings);

  return (
    <>
      <PageHeader title={<MonthSwitcher />} right={<SyncBadge />} />
      {error ? (
        <LoadError />
      ) : (
        records && (
          <>
            <div className="mx-4 mb-3 grid grid-cols-3 rounded-3xl bg-surface py-4 text-center">
              <div>
                <p className="text-[12px] text-ink-3">수입</p>
                <p className="num mt-1 text-[16px] font-bold text-income">{formatNumber(income)}</p>
              </div>
              <div className="border-x border-line">
                <p className="text-[12px] text-ink-3">지출</p>
                <p className="num mt-1 text-[16px] font-bold">{formatNumber(expense)}</p>
              </div>
              <div>
                <p className="text-[12px] text-ink-3">순수입</p>
                <p className={`num mt-1 text-[16px] font-bold ${income - expense < 0 ? "text-danger" : ""}`}>{formatNumber(income - expense)}</p>
              </div>
            </div>
            {groups.length === 0 ? (
              <p className="py-16 text-center text-[15px] text-ink-3">이 달 내역이 없어요</p>
            ) : (
              <div className="space-y-3">
                {groups.map(([date, items]) => {
                  const spent = items.filter((r) => r.kind === "지출").reduce((n, r) => n + r.amount, 0);
                  return (
                    <section key={date} className="mx-4 rounded-3xl bg-surface py-2">
                      <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[13px] text-ink-3">
                        <span className="font-medium text-ink-2">{formatDayHeader(date)}</span>
                        {spent > 0 && <span className="num">-{formatNumber(spent)}원</span>}
                      </div>
                      {items.map((r) => (
                        <RecordRow
                          key={r.id}
                          r={r}
                          onClick={() => setEditing(r)}
                          note={!r.synced && <span className="text-[11px] text-ink-3">시트 반영 대기</span>}
                        />
                      ))}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )
      )}

      <button
        aria-label="입력"
        onClick={() => setEditing("new")}
        className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-20 grid size-14 place-items-center rounded-full bg-ink text-surface shadow-lg shadow-black/15 active:scale-95"
      >
        <Plus size={26} />
      </button>

      <RecordSheet
        open={editing !== null}
        settings={settings}
        initial={editing && editing !== "new" ? editing : undefined}
        onClose={() => setEditing(null)}
        onSave={async (d) => {
          if (editing && editing !== "new") await updateRecord(editing.id, d);
          else await addRecords([d]);
          afterChange();
        }}
        onDelete={
          editing && editing !== "new"
            ? async () => {
                await deleteRecord(editing);
                afterChange();
              }
            : undefined
        }
      />
    </>
  );
}
