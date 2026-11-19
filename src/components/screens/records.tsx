"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Import, Plus } from "lucide-react";
import { useConnection } from "@/lib/connection";
import { formatDayHeader, formatNumber } from "@/lib/format";
import {
  addRecords,
  deleteRecord,
  toRecords,
  updateRecord,
  useSheet,
} from "@/lib/store";
import type { MoneyRecord } from "@/lib/types";
import { balances, monthEnd } from "@/lib/analytics";
import {
  accountGroups,
  filterNames,
  matchesFilter,
  setRecordFilter,
  useRecordFilter,
} from "@/lib/record-filter";
import { useMonth } from "../app-shell";
import { MonthSwitcher } from "../month-switcher";
import { RecordRow } from "../record-row";
import { RecordSheet } from "../record-sheet";
import { SyncBadge, SyncError } from "../sync-badge";
import { LoadError, PageHeader } from "../ui";

export function RecordsScreen() {
  const { month } = useMonth();
  const conn = useConnection()!;
  const { data, error } = useSheet();
  const settings = data?.settings;
  const filter = useRecordFilter();
  const groupsOfAccounts = useMemo(
    () => accountGroups(settings?.accounts ?? []),
    [settings],
  );
  const names = useMemo(
    () => filterNames(filter, settings?.accounts ?? []),
    [filter, settings],
  );
  const records = useMemo(
    // 시트는 PC에서 아무 줄에나 쓸 수 있어서 화면에서 날짜 내림차순으로 다시 정렬 (같은 날은 아래쪽 줄이 위로)
    () =>
      data
        ? toRecords(data.rows)
            .filter((r) => r.date.startsWith(month) && matchesFilter(r, names))
            .reverse()
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        : undefined,
    [data, month, names],
  );
  // 계좌를 골랐으면 그 계좌(들)의 이 달 말 잔고
  const balance = useMemo(() => {
    if (!names || !data || !settings) return null;
    const list = balances(
      settings.accounts,
      toRecords(data.rows),
      monthEnd(month),
    ).filter((a) => names.has(a.name));
    return {
      total: list.reduce((n, a) => n + a.balance, 0),
      debt: list.every((a) => a.kind === "부채"),
    };
  }, [names, data, settings, month]);
  const selectedGroup = groupsOfAccounts.find(
    (g) => g.category === filter.category,
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
      <PageHeader
        title={<MonthSwitcher />}
        right={
          <div className="flex items-center gap-1.5">
            <Link
              href="/import"
              aria-label="뱅크샐러드 가져오기"
              className="flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-[12px] font-semibold text-surface"
            >
              <Import size={14} /> 가져오기
            </Link>
            <SyncBadge />
          </div>
        }
      />
      <SyncError />
      {error && !records ? (
        <LoadError />
      ) : (
        records && (
          <>
            <div className="mx-4 mb-3 grid grid-cols-3 rounded-3xl bg-surface py-4 text-center">
              <div>
                <p className="text-[12px] text-ink-3">수입</p>
                <p className="num mt-1 text-[16px] font-bold text-income">
                  {formatNumber(income)}
                </p>
              </div>
              <div className="border-x border-line">
                <p className="text-[12px] text-ink-3">지출</p>
                <p className="num mt-1 text-[16px] font-bold">
                  {formatNumber(expense)}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-ink-3">순수입</p>
                <p
                  className={`num mt-1 text-[16px] font-bold ${income - expense < 0 ? "text-danger" : ""}`}
                >
                  {formatNumber(income - expense)}
                </p>
              </div>
            </div>
            {groupsOfAccounts.length > 0 && (
              <div className="mb-3 space-y-2">
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4">
                  <FilterChip
                    active={!filter.category}
                    onClick={() => setRecordFilter({})}
                  >
                    전체
                  </FilterChip>
                  {groupsOfAccounts.map((g) => (
                    <FilterChip
                      key={g.category}
                      active={filter.category === g.category}
                      onClick={() => setRecordFilter({ category: g.category })}
                    >
                      {g.category}
                    </FilterChip>
                  ))}
                </div>
                {selectedGroup && selectedGroup.names.length > 1 && (
                  <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4">
                    <FilterChip
                      small
                      active={!filter.account}
                      onClick={() =>
                        setRecordFilter({ category: selectedGroup.category })
                      }
                    >
                      전부
                    </FilterChip>
                    {selectedGroup.names.map((n) => (
                      <FilterChip
                        key={n}
                        small
                        active={filter.account === n}
                        onClick={() =>
                          setRecordFilter({
                            category: selectedGroup.category,
                            account: n,
                          })
                        }
                      >
                        {n}
                      </FilterChip>
                    ))}
                  </div>
                )}
                {balance && (
                  <p className="num px-5 text-right text-[13px] text-ink-3">
                    {filter.account ?? filter.category} {Number(month.slice(5))}
                    월 말 {balance.debt ? "갚을 돈" : "잔고"}{" "}
                    <span
                      className={`font-semibold ${balance.debt ? "text-danger" : "text-ink"}`}
                    >
                      {formatNumber(balance.total)}원
                    </span>
                  </p>
                )}
              </div>
            )}
            {groups.length === 0 ? (
              <div className="py-14 text-center">
                <p className="text-[15px] text-ink-3">
                  {names
                    ? "이 달 이 계좌 내역이 없어요"
                    : "이 달 내역이 없어요"}
                </p>
                <Link
                  href="/import"
                  className="mt-3 inline-flex h-10 items-center rounded-full bg-accent-soft px-4 text-[14px] font-semibold text-accent"
                >
                  뱅크샐러드 내역 가져오기
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map(([date, items]) => {
                  const spent = items
                    .filter((r) => r.kind === "지출")
                    .reduce((n, r) => n + r.amount, 0);
                  return (
                    <section
                      key={date}
                      className="mx-4 rounded-3xl bg-surface py-2"
                    >
                      <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[13px] text-ink-3">
                        <span className="font-medium text-ink-2">
                          {formatDayHeader(date)}
                        </span>
                        {spent > 0 && (
                          <span className="num">-{formatNumber(spent)}원</span>
                        )}
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
          if (editing && editing !== "new")
            await updateRecord(conn, editing, d, settings?.accounts);
          else await addRecords(conn, [d], settings?.accounts);
        }}
        onDelete={
          editing && editing !== "new"
            ? () => deleteRecord(conn, editing, settings?.accounts)
            : undefined
        }
      />
    </>
  );
}

function FilterChip({
  active,
  small,
  onClick,
  children,
}: {
  active: boolean;
  small?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 whitespace-nowrap transition ${small ? "h-7 text-[13px]" : "h-8 text-[14px]"} ${
        active ? "bg-ink text-surface" : "bg-surface text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}
