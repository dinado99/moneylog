"use client";

import { useState } from "react";
import { categoriesFor, defaultCategory } from "@/lib/categories";
import { formatNumber, todayString } from "@/lib/format";
import type { TxnDraft, TxnType } from "@/lib/types";
import { Sheet } from "./sheet";
import { Button, Segmented } from "./ui";

const TYPE_OPTIONS: { value: TxnType; label: string }[] = [
  { value: "expense", label: "지출" },
  { value: "income", label: "수입" },
  { value: "transfer", label: "이체" },
];

function emptyDraft(): TxnDraft {
  return { date: todayString(), type: "expense", amount: 0, category: "미분류", merchant: "" };
}

interface Props {
  open: boolean;
  initial?: TxnDraft;
  onClose: () => void;
  onSave: (draft: TxnDraft) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  saveLabel?: string;
}

export function TxnSheet(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose}>
      {/* 열릴 때마다 폼 상태를 초기값으로 리셋 */}
      {props.open && <TxnForm {...props} />}
    </Sheet>
  );
}

function TxnForm({ initial, onClose, onSave, onDelete, saveLabel = "저장" }: Props) {
  const [d, setD] = useState<TxnDraft>(() => initial ?? emptyDraft());
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TxnDraft>(k: K, v: TxnDraft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const categories = categoriesFor(d.type);
  const valid = d.amount > 0 && d.merchant.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(d.date);

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      await onSave({ ...d, merchant: d.merchant.trim(), memo: d.memo?.trim() || undefined });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 pb-5">
      <Segmented
        value={d.type}
        options={TYPE_OPTIONS}
        onChange={(type) =>
          setD((prev) => ({
            ...prev,
            type,
            category: categoriesFor(type).some((c) => c.name === prev.category) ? prev.category : defaultCategory(type),
          }))
        }
      />

      <label className="mt-6 block">
        <span className="text-[13px] text-ink-3">금액</span>
        <div className="mt-1 flex items-baseline gap-1 border-b border-line pb-2 focus-within:border-ink">
          <input
            inputMode="numeric"
            autoFocus={!initial}
            placeholder="0"
            value={d.amount ? formatNumber(d.amount) : ""}
            onChange={(e) => set("amount", Number(e.target.value.replace(/\D/g, "").slice(0, 12)) || 0)}
            className="num w-full bg-transparent text-[30px] font-bold outline-none placeholder:text-line"
          />
          <span className="text-[20px] font-semibold text-ink-2">원</span>
        </div>
      </label>

      <Field label="내용">
        <input
          value={d.merchant}
          placeholder="어디에 썼나요?"
          onChange={(e) => set("merchant", e.target.value)}
          className="w-full bg-transparent outline-none placeholder:text-ink-3"
        />
      </Field>

      <div className="mt-5">
        <span className="text-[13px] text-ink-3">분류</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.name}
              onClick={() => set("category", c.name)}
              className={`h-8 rounded-full px-3 text-[14px] transition ${
                d.category === c.name ? "bg-ink text-surface" : "bg-surface-2 text-ink-2"
              }`}
            >
              {c.name}
            </button>
          ))}
          {!categories.some((c) => c.name === d.category) && (
            <span className="h-8 rounded-full bg-ink px-3 text-[14px] leading-8 text-surface">{d.category}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="날짜">
          <input
            type="date"
            value={d.date}
            onChange={(e) => set("date", e.target.value)}
            className="w-full bg-transparent outline-none"
          />
        </Field>
        <Field label="시간">
          <input
            type="time"
            value={d.time ?? ""}
            onChange={(e) => set("time", e.target.value || undefined)}
            className="w-full bg-transparent outline-none"
          />
        </Field>
      </div>

      <Field label="결제수단">
        <input
          value={d.method ?? ""}
          placeholder="선택"
          onChange={(e) => set("method", e.target.value || undefined)}
          className="w-full bg-transparent outline-none placeholder:text-ink-3"
        />
      </Field>
      <Field label="메모">
        <input
          value={d.memo ?? ""}
          placeholder="선택"
          onChange={(e) => set("memo", e.target.value)}
          className="w-full bg-transparent outline-none placeholder:text-ink-3"
        />
      </Field>

      <div className="mt-7 flex gap-2">
        {onDelete && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              await onDelete();
              onClose();
            }}
          >
            삭제
          </Button>
        )}
        <Button className="flex-1" disabled={!valid || busy} onClick={submit}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-5 block">
      <span className="text-[13px] text-ink-3">{label}</span>
      <div className="mt-1 border-b border-line pb-2 text-[16px] focus-within:border-ink">{children}</div>
    </label>
  );
}
