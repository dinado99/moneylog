"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileSpreadsheet, Images, LoaderCircle } from "lucide-react";
import { addMany, existingHashes, txnHash } from "@/lib/db";
import { formatNumber, todayString } from "@/lib/format";
import { ImportError, parseSpreadsheetFile } from "@/lib/import/file";
import { screenshotToTiles } from "@/lib/import/image";
import type { ImageParseRequest, ImageParseResult } from "@/lib/import/image-schema";
import { supabase } from "@/lib/supabase";
import type { TxnDraft, TxnSource } from "@/lib/types";
import { useMonth } from "../app-shell";
import { TxnRow } from "../txn-row";
import { TxnSheet } from "../txn-sheet";
import { Button, Card, PageHeader } from "../ui";

interface Item {
  key: number;
  draft: TxnDraft;
  dup: boolean;
  selected: boolean;
}

type State =
  | { step: "pick"; error?: string }
  | { step: "working"; label: string }
  | { step: "review"; source: TxnSource; items: Item[]; note?: string; skipped: number };

async function buildItems(drafts: TxnDraft[]): Promise<Item[]> {
  const existing = await existingHashes(drafts);
  const seen = new Set<string>();
  return drafts.map((draft, key) => {
    const h = txnHash(draft);
    // 이미 저장된 내역은 기본 해제. 같은 파일 안의 동일 거래는 실제 중복 결제일 수 있어 그대로 둔다.
    const dup = existing.has(h) && !seen.has(h);
    seen.add(h);
    return { key, draft, dup, selected: !dup };
  });
}

export function ImportScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const [state, setState] = useState<State>({ step: "pick" });
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleImages(files: FileList | null) {
    if (!files?.length) return;
    setState({ step: "working", label: "캡처를 읽고 있어요" });
    try {
      const screens = await Promise.all([...files].map(screenshotToTiles));
      const body: ImageParseRequest = { screens, month, today: todayString() };
      const { data } = await supabase().auth.getSession();
      const res = await fetch("/api/parse-image", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new ImportError(json?.error ?? "분석에 실패했어요.");
      const result = json as ImageParseResult;
      const drafts: TxnDraft[] = result.transactions.map((t) => ({
        date: t.date,
        time: t.time ?? undefined,
        type: t.type,
        amount: Math.abs(t.amount),
        merchant: t.merchant,
        category: t.category,
        method: t.method ?? undefined,
      }));
      setState({
        step: "review",
        source: "image",
        items: await buildItems(drafts),
        note: result.note ?? undefined,
        skipped: 0,
      });
    } catch (e) {
      console.error(e);
      setState({ step: "pick", error: e instanceof ImportError ? e.message : "캡처를 처리하지 못했어요." });
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setState({ step: "working", label: "파일을 정리하고 있어요" });
    try {
      const { rows, skipped } = await parseSpreadsheetFile(file);
      setState({ step: "review", source: "excel", items: await buildItems(rows), skipped });
    } catch (e) {
      console.error(e);
      setState({ step: "pick", error: e instanceof ImportError ? e.message : "파일을 읽지 못했어요." });
    }
  }

  if (state.step === "working") {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-ink-2">
        <LoaderCircle size={32} className="animate-spin text-ink-3" />
        <p className="text-[16px] font-medium">{state.label}</p>
      </div>
    );
  }

  if (state.step === "review") {
    const { items } = state;
    const selected = items.filter((i) => i.selected);
    const dupCount = items.filter((i) => i.dup).length;
    const total = selected.filter((i) => i.draft.type === "expense").reduce((s, i) => s + i.draft.amount, 0);
    const update = (fn: (items: Item[]) => Item[]) => setState({ ...state, items: fn(items) });
    const editing = items.find((i) => i.key === editingKey);

    return (
      <>
        <PageHeader
          title="확인하고 저장"
          right={
            <button className="text-[15px] text-ink-3" onClick={() => setState({ step: "pick" })}>
              취소
            </button>
          }
        />
        <div className="px-5 pb-4 text-[14px] leading-relaxed text-ink-3">
          <p>
            <span className="font-semibold text-ink">{items.length}건</span>을 찾았어요.
            {dupCount > 0 && ` 이미 있는 ${dupCount}건은 빼뒀어요.`}
            {state.skipped > 0 && ` 날짜·금액을 못 읽은 ${state.skipped}줄은 건너뛰었어요.`}
          </p>
          {state.note && <p className="mt-1">{state.note}</p>}
          <p className="mt-1">항목을 누르면 고칠 수 있어요.</p>
        </div>

        {items.length > 0 ? (
          <Card className="py-2">
            <div className="flex justify-end px-5 py-1">
              <button
                className="text-[13px] font-medium text-accent"
                onClick={() => {
                  const all = selected.length !== items.length;
                  update((list) => list.map((i) => ({ ...i, selected: all })));
                }}
              >
                {selected.length === items.length ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            {items.map((item) => (
              <TxnRow
                key={item.key}
                t={item.draft}
                onClick={() => setEditingKey(item.key)}
                leading={
                  <span
                    role="checkbox"
                    aria-checked={item.selected}
                    onClick={(e) => {
                      e.stopPropagation();
                      update((list) => list.map((i) => (i.key === item.key ? { ...i, selected: !i.selected } : i)));
                    }}
                    className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${
                      item.selected ? "border-ink bg-ink text-surface" : "border-line"
                    }`}
                  >
                    {item.selected && <Check size={14} strokeWidth={3} />}
                  </span>
                }
                trailingNote={
                  <span className="text-[12px] text-ink-3">
                    {item.dup ? "이미 있음" : item.draft.date.slice(5).replace("-", ".")}
                  </span>
                }
              />
            ))}
          </Card>
        ) : (
          <p className="py-12 text-center text-[15px] text-ink-3">가져올 내역이 없어요</p>
        )}

        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-20 mx-auto max-w-md bg-gradient-to-t from-bg via-bg to-transparent px-4 pt-6 pb-3">
          <Button
            className="w-full"
            disabled={!selected.length || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await addMany(
                  selected.map((i) => i.draft),
                  state.source,
                );
                // 탭을 오가도 화면 상태가 유지되므로 다음 가져오기를 위해 처음으로 되돌린다
                setState({ step: "pick" });
                router.push("/history");
              } catch {
                alert("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {selected.length}건 저장{total > 0 && ` · 지출 ${formatNumber(total)}원`}
          </Button>
        </div>
        <div className="h-20" />

        <TxnSheet
          open={!!editing}
          initial={editing?.draft}
          saveLabel="수정"
          onClose={() => setEditingKey(null)}
          onSave={(draft) =>
            update((list) => list.map((i) => (i.key === editingKey ? { ...i, draft, selected: true } : i)))
          }
          onDelete={() => update((list) => list.filter((i) => i.key !== editingKey))}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="가져오기" />
      {state.error && (
        <p className="mx-4 mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger">{state.error}</p>
      )}

      <div className="space-y-3">
        <ImportOption
          icon={<Images size={22} />}
          title="캡처로 가져오기"
          desc="뱅크샐러드 가계부 화면을 캡처해서 올려 주세요. 여러 장도 한 번에 돼요."
          onClick={() => imageInput.current?.click()}
        />
        <ImportOption
          icon={<FileSpreadsheet size={22} />}
          title="엑셀 · CSV로 가져오기"
          desc="뱅크샐러드에서 내보낸 엑셀(.xlsx)이나 카드사·은행 내역(.csv)을 올려 주세요."
          onClick={() => fileInput.current?.click()}
        />
      </div>

      <div className="mx-5 mt-6 space-y-2 text-[13px] leading-relaxed text-ink-3">
        <p>· 날짜·분류·결제수단은 자동으로 나눠 넣어요. 저장 전에 한 번 확인할 수 있어요.</p>
        <p>· 이미 저장된 내역과 같은 건 자동으로 빼둬요.</p>
        <p>· 캡처에 연·월이 안 보이면 지금 보고 있는 달로 넣어요.</p>
        <p>· 뱅크샐러드 엑셀은 앱의 설정 › 데이터 내보내기에서 받을 수 있어요.</p>
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          handleImages(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

function ImportOption({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="mx-4 flex w-[calc(100%-2rem)] items-start gap-4 rounded-3xl bg-surface p-5 text-left active:scale-[0.99]">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</span>
      <span>
        <span className="block text-[16px] font-semibold">{title}</span>
        <span className="mt-1 block text-[14px] leading-snug text-ink-3">{desc}</span>
      </span>
    </button>
  );
}
