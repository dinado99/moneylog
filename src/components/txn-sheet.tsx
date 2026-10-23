"use client";

import { useState } from "react";
import { TRANSFER_CATEGORIES } from "@/lib/categories";
import { mainCategories, useSettings, type Settings } from "@/lib/settings-db";
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
  return { date: todayString(), type: "expense", amount: 0, category: "", merchant: "" };
}

interface Choice {
  name: string;
  emoji?: string | null;
  subs: string[];
}

function choicesFor(s: Settings | undefined, type: TxnDraft["type"]): Choice[] {
  if (type === "transfer") return TRANSFER_CATEGORIES.map((name) => ({ name, subs: [] }));
  if (!s) return [];
  return mainCategories(s, type).map((m) => ({ name: m.name, emoji: m.emoji, subs: m.subs.map((c) => c.name) }));
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
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof TxnDraft>(k: K, v: TxnDraft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const { data: settings } = useSettings();
  const categories = choicesFor(settings, d.type);
  const current = categories.find((c) => c.name === d.category);
  const valid = d.amount > 0 && d.merchant.trim() !== "" && d.category !== "" && /^\d{4}-\d{2}-\d{2}$/.test(d.date);

  async function submit() {
    if (!valid) return;
    await run(() => onSave({ ...d, merchant: d.merchant.trim(), memo: d.memo?.trim() || undefined }));
  }

  async function run(action: () => void | Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch {
      setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
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
          setD((prev) => {
            const keep = choicesFor(settings, type).some((c) => c.name === prev.category);
            return { ...prev, type, category: keep ? prev.category : "", subcategory: keep ? prev.subcategory : undefined };
          })
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
            <Chip
              key={c.name}
              active={d.category === c.name}
              onClick={() => setD((prev) => ({ ...prev, category: c.name, subcategory: undefined }))}
            >
              {c.emoji && <span className="mr-1">{c.emoji}</span>}
              {c.name}
            </Chip>
          ))}
          {d.category && !current && <Chip active>{d.category}</Chip>}
        </div>
        {current && current.subs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 rounded-2xl bg-surface-2 p-2">
            {current.subs.map((sub) => (
              <Chip
                key={sub}
                small
                active={d.subcategory === sub}
                onClick={() => set("subcategory", d.subcategory === sub ? undefined : sub)}
              >
                {sub}
              </Chip>
            ))}
          </div>
        )}
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
        <select
          value={d.method ?? ""}
          onChange={(e) => set("method", e.target.value || undefined)}
          className={`w-full appearance-none bg-transparent outline-none ${d.method ? "" : "text-ink-3"}`}
        >
          <option value="">선택 안 함</option>
          {settings?.groups.map((g) => {
            const assets = settings.assets.filter((a) => a.group_id === g.id);
            return assets.length ? (
              <optgroup key={g.id} label={`${g.emoji ?? ""} ${g.name}`.trim()}>
                {assets.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
          {d.method && !settings?.assets.some((a) => a.name === d.method) && <option value={d.method}>{d.method}</option>}
        </select>
      </Field>
      <Field label="메모">
        <input
          value={d.memo ?? ""}
          placeholder="선택"
          onChange={(e) => set("memo", e.target.value)}
          className="w-full bg-transparent outline-none placeholder:text-ink-3"
        />
      </Field>

      {error && <p className="mt-5 text-[14px] text-danger">{error}</p>}
      <div className="mt-7 flex gap-2">
        {onDelete && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => run(onDelete)}
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

function Chip({
  active,
  small,
  onClick,
  children,
}: {
  active?: boolean;
  small?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 transition ${small ? "h-7 text-[13px]" : "h-8 text-[14px]"} ${
        active ? "bg-ink text-surface" : small ? "bg-surface text-ink-2" : "bg-surface-2 text-ink-2"
      }`}
    >
      {children}
    </button>
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
