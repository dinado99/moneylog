"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useConnection } from "@/lib/connection";
import { formatDayHeader, formatNumber } from "@/lib/format";
import { addRecords, deleteRecord, toRecords, updateRecord, useSheet } from "@/lib/store";
import type { MoneyRecord } from "@/lib/types";
import { useMonth } from "../app-shell";
import { MonthSwitcher } from "../month-switcher";
import { RecordRow } from "../record-row";
import { RecordSheet } from "../record-sheet";
import { SyncBadge } from "../sync-badge";
import { LoadError, PageHeader } from "../ui";

export function RecordsScreen() {
  const { month } = useMonth();
  const conn = useConnection()!;
  const { data, error } = useSheet();
  const settings = data?.settings;
  const records = useMemo(
    // 시트는 PC에서 아무 줄에나 쓸 수 있어서 화면에서 날짜 내림차순으로 다시 정렬 (같은 날은 아래쪽 줄이 위로)
    () =>
      data
        ? toRecords(data.rows)
            .filter((r) => r.date.startsWith(month))
            .reverse()
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        : undefined,
    [data, month],
  );
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

  return (
    <>
      <PageHeader title={<MonthSwitcher />} right={<SyncBadge />} />
      {error && !records ? (
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
          if (editing && editing !== "new") await updateRecord(conn, editing, d);
          else await addRecords(conn, [d]);
        }}
        onDelete={editing && editing !== "new" ? () => deleteRecord(conn, editing) : undefined}
      />
    </>
  );
}
