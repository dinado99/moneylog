"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardPaste, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { addMany, existingHashes, txnHash } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import type { AssetRow } from "@/lib/import/assets";
import { ImportError, parsePastedText, parseSpreadsheetFile, type ImportResult } from "@/lib/import/file";
import { mapDraft } from "@/lib/import/map";
import { applyAssetBalances, ensureAssets, findAsset, guessGroup, loadSettings, type Settings } from "@/lib/settings-db";
import type { TxnDraft, TxnSource } from "@/lib/types";
import { Sheet } from "../sheet";
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
  | {
      step: "review";
      source: TxnSource;
      items: Item[];
      skipped: number;
      assets: AssetPlan[];
      assetsOn: boolean;
    };

interface AssetPlan extends AssetRow {
  /** 이미 있는 자산이면 그 이름 */
  existing?: string;
  group?: string;
}

function planAssets(s: Settings, rows: AssetRow[]): AssetPlan[] {
  return rows.map((r) => {
    const existing = findAsset(s, r.name);
    const groupId = existing?.group_id ?? guessGroup(s, r.name, r.kind)?.id;
    const g = s.groups.find((x) => x.id === groupId);
    return { ...r, existing: existing?.name, group: g ? `${g.emoji ?? ""} ${g.name}`.trim() : undefined };
  });
}

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
  const [state, setState] = useState<State>({ step: "pick" });
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function load(parse: () => Promise<ImportResult>, fallbackError: string) {
    setState({ step: "working", label: "내역을 정리하고 있어요" });
    try {
      const [{ txns, assets }, settings] = await Promise.all([parse(), loadSettings()]);
      const mapped = txns.rows.map((d) => mapDraft(settings, d));
      setState({
        step: "review",
        source: "excel",
        items: await buildItems(mapped),
        skipped: txns.skipped,
        assets: planAssets(settings, assets),
        assetsOn: assets.length > 0,
      });
    } catch (e) {
      console.error(e);
      setState({ step: "pick", error: e instanceof ImportError ? e.message : fallbackError });
    }
  }

  const handleFile = (file: File | undefined) =>
    file && load(() => parseSpreadsheetFile(file), "파일을 읽지 못했어요.");

  const handlePaste = () => {
    setPasteOpen(false);
    load(async () => parsePastedText(pasteText), "붙여넣은 내용을 읽지 못했어요.");
    setPasteText("");
  };

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
    const assetCount = state.assetsOn ? state.assets.length : 0;

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
        {state.assets.length > 0 && (
          <Card className="mb-3 py-2">
            <div className="flex items-center justify-between px-5 py-2">
              <div>
                <p className="text-[16px] font-semibold">자산 잔액 {state.assets.length}개</p>
                <p className="text-[13px] text-ink-3">있는 자산은 잔액만 바꾸고, 없는 건 새로 추가해요.</p>
              </div>
              <button
                role="checkbox"
                aria-checked={state.assetsOn}
                aria-label="자산 잔액 반영"
                onClick={() => setState({ ...state, assetsOn: !state.assetsOn })}
                className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${
                  state.assetsOn ? "border-ink bg-ink text-surface" : "border-line"
                }`}
              >
                {state.assetsOn && <Check size={14} strokeWidth={3} />}
              </button>
            </div>
            {state.assets.map((a, i) => (
              <div key={i} className={`flex items-center gap-3 px-5 py-2.5 ${state.assetsOn ? "" : "opacity-40"}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{a.existing ?? a.name}</span>
                  <span className="block truncate text-[12px] text-ink-3">
                    {a.existing ? "잔액 업데이트" : `새 자산 · ${a.group ?? ""}`}
                  </span>
                </span>
                <span className="num shrink-0 text-[15px] font-medium">{formatNumber(a.balance)}원</span>
              </div>
            ))}
          </Card>
        )}

        {(items.length > 0 || !state.assets.length) && (
          <div className="px-5 pb-4 text-[14px] leading-relaxed text-ink-3">
            <p>
              <span className="font-semibold text-ink">{items.length}건</span>을 찾았어요.
              {dupCount > 0 && ` 이미 있는 ${dupCount}건은 빼뒀어요.`}
              {state.skipped > 0 && ` 날짜·금액을 못 읽은 ${state.skipped}줄은 건너뛰었어요.`}
            </p>
            {items.length > 0 && <p className="mt-1">항목을 누르면 고칠 수 있어요.</p>}
          </div>
        )}

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
          !state.assets.length && <p className="py-12 text-center text-[15px] text-ink-3">가져올 내역이 없어요</p>
        )}

        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-20 mx-auto max-w-md bg-gradient-to-t from-bg via-bg to-transparent px-4 pt-6 pb-3">
          <Button
            className="w-full"
            disabled={(!selected.length && !assetCount) || saving}
            onClick={async () => {
              setSaving(true);
              try {
                if (assetCount) await applyAssetBalances(await loadSettings(), state.assets);
                const drafts = selected.map((i) => i.draft);
                if (drafts.length) {
                  await addMany(drafts, state.source);
                  // 처음 보는 결제수단은 자산에 자동으로 추가
                  await ensureAssets(await loadSettings(), drafts.map((d) => d.method ?? "")).catch(console.error);
                }
                // 탭을 오가도 화면 상태가 유지되므로 다음 가져오기를 위해 처음으로 되돌린다
                setState({ step: "pick" });
                router.push(drafts.length ? "/history" : "/settings/assets");
              } catch {
                alert("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {[selected.length > 0 && `${selected.length}건`, assetCount > 0 && `자산 ${assetCount}개`].filter(Boolean).join(" · ") ||
              "0건"}{" "}
            저장{total > 0 && ` · 지출 ${formatNumber(total)}원`}
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
          icon={<FileSpreadsheet size={22} />}
          title="엑셀 · CSV 파일"
          desc="뱅크샐러드에서 내보낸 엑셀(.xlsx)이나 카드사·은행 내역(.csv)을 올려 주세요. 자산 잔액도 같이 읽어요."
          onClick={() => fileInput.current?.click()}
        />
        <ImportOption
          icon={<ClipboardPaste size={22} />}
          title="표 붙여넣기"
          desc="엑셀에서 제목 줄까지 복사해서 붙여넣어 주세요. 자산 현황(항목·상품명·금액) 표도 돼요."
          onClick={() => setPasteOpen(true)}
        />
      </div>

      <div className="mx-5 mt-6 space-y-2 text-[13px] leading-relaxed text-ink-3">
        <p>· 날짜·분류·결제수단은 자동으로 나눠 넣어요. 저장 전에 한 번 확인할 수 있어요.</p>
        <p>· 이미 저장된 내역과 같은 건 자동으로 빼둬요.</p>
        <p>· 뱅크샐러드 엑셀은 앱의 설정 › 데이터 내보내기에서 받을 수 있어요.</p>
      </div>

      <Sheet open={pasteOpen} onClose={() => setPasteOpen(false)}>
        <div className="px-5 pb-5">
          <p className="text-[17px] font-semibold">표 붙여넣기</p>
          <textarea
            autoFocus
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"날짜\t시간\t타입\t대분류\t…\n2026-10-22\t18:29\t지출\t카페/간식\t…"}
            className="mt-4 h-56 w-full resize-none rounded-2xl bg-surface-2 p-4 text-[14px] leading-relaxed outline-none placeholder:text-ink-3"
          />
          <Button className="mt-4 w-full" disabled={!pasteText.trim()} onClick={handlePaste}>
            읽어오기
          </Button>
        </div>
      </Sheet>
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
