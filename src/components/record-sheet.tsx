"use client";

import { useRef, useState } from "react";
import { formatNumber, splitEmoji, todayString } from "@/lib/format";
import type { Kind, RecordDraft, SheetSettings } from "@/lib/types";
import { Sheet } from "./sheet";
import { Button, Segmented } from "./ui";

const KINDS: { value: Kind; label: string }[] = [
  { value: "지출", label: "지출" },
  { value: "수입", label: "수입" },
  { value: "이동", label: "이동" },
];

interface Props {
  open: boolean;
  settings?: SheetSettings;
  initial?: RecordDraft;
  onClose: () => void;
  onSave: (d: RecordDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  saveLabel?: string;
}

export function RecordSheet(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose}>
      {props.open && <RecordForm {...props} />}
    </Sheet>
  );
}

function RecordForm({ settings, initial, onClose, onSave, onDelete, saveLabel = "저장" }: Props) {
  const [d, setD] = useState<RecordDraft>(() => initial ?? { date: todayString(), kind: "지출", content: "", amount: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 금액을 지우고 다시 입력할 때도 −를 기억
  const [minus, setMinus] = useState(() => (initial?.amount ?? 0) < 0);
  const amountRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof RecordDraft>(k: K, v: RecordDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const cats = (settings?.categories ?? []).filter((c) => c.kind === d.kind);
  const current = cats.find((c) => c.name === d.category);
  const needsCategory = d.kind !== "이동" && cats.length > 0;
  // 지출·수입은 음수(차감)도 된다. 이동은 양수만
  const valid = (d.kind === "이동" ? d.amount > 0 : d.amount !== 0) && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && (!needsCategory || !!d.category);
  const negative = d.amount < 0 || (d.amount === 0 && minus);

  async function run(action: () => Promise<void>) {
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
        value={d.kind}
        options={KINDS}
        onChange={(kind) =>
          setD((p) => {
            const keep = (settings?.categories ?? []).some((c) => c.kind === kind && c.name === p.category);
            if (kind === "이동") setMinus(false);
            return {
              ...p,
              kind,
              amount: kind === "이동" ? Math.abs(p.amount) : p.amount,
              category: keep ? p.category : undefined,
              subcategory: keep ? p.subcategory : undefined,
            };
          })
        }
      />

      <label className="mt-6 block">
        <span className="text-[13px] text-ink-3">금액</span>
        <div className="mt-1 flex items-center gap-1 border-b border-line pb-2 focus-within:border-ink">
          {d.kind !== "이동" && (
            <button
              type="button"
              aria-label="차감(음수)"
              aria-pressed={negative}
              onClick={(e) => {
                e.preventDefault();
                setMinus(!negative);
                set("amount", -d.amount);
                // 누른 뒤 바로 숫자를 칠 수 있게
                amountRef.current?.focus();
              }}
              className={`mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[20px] font-bold transition ${
                negative ? "bg-ink text-surface" : "bg-surface-2 text-ink-3"
              }`}
            >
              −
            </button>
          )}
          <input
            ref={amountRef}
            inputMode="numeric"
            autoFocus={!initial}
            placeholder="0"
            value={d.amount ? `${negative ? "−" : ""}${formatNumber(Math.abs(d.amount))}` : ""}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, "").slice(0, 12)) || 0;
              set("amount", negative ? -n : n);
            }}
            className={`num w-full bg-transparent text-[30px] font-bold outline-none placeholder:text-line ${negative ? "text-[#1a9a5c]" : ""}`}
          />
          <span className="text-[20px] font-semibold text-ink-2">원</span>
        </div>
      </label>
      {negative && d.kind !== "이동" && (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
          {d.kind === "지출"
            ? "지출에서 빼요. 엔빵·환불로 돌려받은 돈을 같은 분류에 넣으면 그만큼 덜 쓴 걸로 계산돼요. 계좌는 돈이 들어온 곳을 고르세요."
            : "수입에서 빼요. 잘못 들어온 수입이나 수입 취소에 써요."}
        </p>
      )}

      <Field label="내용">
        <input
          value={d.content}
          placeholder={d.kind === "이동" ? "예: 적금 이체" : "어디에서?"}
          onChange={(e) => set("content", e.target.value)}
          className="w-full bg-transparent outline-none placeholder:text-ink-3"
        />
      </Field>

      {d.kind !== "이동" && (
        <div className="mt-5">
          <span className="text-[13px] text-ink-3">대분류</span>
          {cats.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cats.map((c) => {
                const { emoji, label } = splitEmoji(c.name);
                return (
                  <Chip key={c.name} active={d.category === c.name} onClick={() => setD((p) => ({ ...p, category: c.name, subcategory: undefined }))}>
                    {emoji && <span className="mr-1">{emoji}</span>}
                    {label}
                  </Chip>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-ink-3">시트를 연결하면 &apos;가계부 설정&apos;의 분류가 여기에 나와요.</p>
          )}
          {current && current.subs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 rounded-2xl bg-surface-2 p-2">
              {current.subs.map((s) => (
                <Chip key={s.name} small active={d.subcategory === s.name} onClick={() => set("subcategory", d.subcategory === s.name ? undefined : s.name)}>
                  {s.name}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      <Field label="날짜">
        <input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} className="w-full bg-transparent outline-none" />
      </Field>

      {d.kind === "이동" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="출금계좌">
            <AccountSelect settings={settings} value={d.outAccount} onChange={(v) => set("outAccount", v)} />
          </Field>
          <Field label="입금계좌">
            <AccountSelect settings={settings} value={d.inAccount} onChange={(v) => set("inAccount", v)} />
          </Field>
        </div>
      ) : d.kind === "수입" ? (
        <Field label="입금계좌">
          <AccountSelect settings={settings} value={d.inAccount} onChange={(v) => set("inAccount", v)} />
        </Field>
      ) : (
        <Field label={negative ? "돈이 들어온 계좌" : "출금계좌 (결제수단)"}>
          <AccountSelect settings={settings} value={d.outAccount} onChange={(v) => set("outAccount", v)} />
        </Field>
      )}

      {error && <p className="mt-5 text-[14px] text-danger">{error}</p>}
      <div className="mt-7 flex gap-2">
        {onDelete && (
          <Button variant="danger" disabled={busy} onClick={() => run(onDelete)}>
            삭제
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!valid || busy}
          onClick={() =>
            run(() =>
              onSave({
                ...d,
                content: d.content.trim(),
                // 구분에 맞지 않는 계좌는 비운다 (시트와 같은 규칙)
                inAccount: d.kind === "지출" ? undefined : d.inAccount,
                outAccount: d.kind === "수입" ? undefined : d.outAccount,
              }),
            )
          }
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

/** 시트 계좌 목록. 같은 이름(현대카드 일시불/할부)은 하나로 보여준다. */
function AccountSelect({ settings, value, onChange }: { settings?: SheetSettings; value?: string; onChange: (v?: string) => void }) {
  const groups = new Map<string, string[]>();
  for (const a of settings?.accounts ?? []) {
    if (a.hidden) continue;
    const list = groups.get(a.category) ?? [];
    if (!list.includes(a.name)) list.push(a.name);
    groups.set(a.category, list);
  }
  const all = [...groups.values()].flat();
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} className={`w-full appearance-none bg-transparent outline-none ${value ? "" : "text-ink-3"}`}>
      <option value="">선택 안 함</option>
      {[...groups].map(([cat, names]) => (
        <optgroup key={cat} label={cat}>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </optgroup>
      ))}
      {value && !all.includes(value) && <option value={value}>{value}</option>}
    </select>
  );
}

function Chip({ active, small, onClick, children }: { active?: boolean; small?: boolean; onClick?: () => void; children: React.ReactNode }) {
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
