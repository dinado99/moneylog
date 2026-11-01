"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardPaste, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { useConnection } from "@/lib/connection";
import { formatNumber, todayString } from "@/lib/format";
import { MAX_ACCOUNTS, planReset, type ResetPlan } from "@/lib/import/accounts-reset";
import { ImportError, parsePastedText, parseSpreadsheetFile, type ImportResult } from "@/lib/import/file";
import { dedupeKey, makeMapper, type Mapped, type Rule } from "@/lib/import/to-sheet";
import { SheetError } from "@/lib/sheet";
import { saveImport, useData } from "@/lib/store";
import type { RecordDraft } from "@/lib/types";
import { RecordRow } from "../record-row";
import { RecordSheet } from "../record-sheet";
import { Sheet } from "../sheet";
import { BackHeader, Button, Card } from "../ui";

interface Item {
  key: number;
  m: Mapped;
  draft: RecordDraft;
  dup: boolean;
  selected: boolean;
}

export function ImportScreen() {
  const router = useRouter();
  const conn = useConnection()!;
  const { records, settings, rules } = useData();
  const [items, setItems] = useState<Item[] | null>(null);
  const [reset, setReset] = useState<ResetPlan | null>(null);
  const [applyReset, setApplyReset] = useState(true);
  const [skipped, setSkipped] = useState(0);
  const [newRules, setNewRules] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const accountNames = useMemo(() => [...new Set((settings?.accounts ?? []).filter((a) => !a.hidden).map((a) => a.name))], [settings]);

  async function load(parse: () => Promise<ImportResult>) {
    if (!settings || !records) return;
    setBusy("내역을 정리하고 있어요");
    setError(null);
    try {
      const { txns, assets: assetRows } = await parse();
      const map = makeMapper(settings, records, rules);
      const existing = new Map<string, number>();
      for (const r of records) existing.set(dedupeKey(r), (existing.get(dedupeKey(r)) ?? 0) + 1);
      setItems(
        txns.rows.map((row, key) => {
          const m = map(row);
          const k = dedupeKey(m.draft);
          const left = existing.get(k) ?? 0;
          if (left) existing.set(k, left - 1);
          return { key, m, draft: m.draft, dup: left > 0, selected: left === 0 };
        }),
      );
      setReset(assetRows.length ? planReset(settings, records, assetRows, map.account, todayString()) : null);
      setApplyReset(true);
      setSkipped(txns.skipped);
      setNewRules([]);
    } catch (e) {
      console.error(e);
      setError(e instanceof ImportError ? e.message : "읽지 못했어요. 파일이나 붙여넣은 내용을 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  function remember(rule: Rule) {
    setNewRules((list) => [...list.filter((r) => !(r.type === rule.type && r.source === rule.source)), rule]);
  }

  /** 같은 결제수단 이름을 쓰는 내역 전부에 계좌를 지정하고 규칙으로 기억 */
  function linkAccount(raw: string, account: string) {
    remember({ type: "계좌", source: raw, category: account, subcategory: "" });
    setItems((list) =>
      list!.map((it) => {
        if (it.m.rawAccount !== raw) return it;
        const d = { ...it.draft };
        if (d.kind === "수입" || (d.kind === "이동" && it.m.raw.incoming)) d.inAccount = account;
        else d.outAccount = account;
        return { ...it, draft: d, m: { ...it.m, needsAccount: false } };
      }),
    );
  }

  async function save() {
    if (!items || !settings || !records) return;
    setBusy("시트에 저장하고 있어요");
    setError(null);
    try {
      if (reset && applyReset && reset.accounts.length > MAX_ACCOUNTS) {
        throw new SheetError(`시트 계좌표에는 ${MAX_ACCOUNTS}개까지 들어가요. 지금 ${reset.accounts.length}개예요.`);
      }
      await saveImport(conn, { drafts: items.filter((i) => i.selected).map((i) => i.draft), rules: newRules, reset: reset && applyReset ? reset : undefined });
      // 탭을 오가도 화면 상태가 남으므로 처음 화면으로 되돌려 둔다
      setItems(null);
      setReset(null);
      router.push("/");
    } catch (e) {
      setError(e instanceof SheetError ? e.message : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  if (busy) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-ink-2">
        <LoaderCircle size={32} className="animate-spin text-ink-3" />
        <p className="text-[16px] font-medium">{busy}</p>
      </div>
    );
  }

  if (!items) {
    return (
      <>
        <BackHeader title="뱅크샐러드 가져오기" href="/" />
        {error && <p className="mx-4 mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger">{error}</p>}
        <div className="space-y-3">
          <Option icon={<FileSpreadsheet size={22} />} title="엑셀 · CSV 파일" desc="뱅크샐러드에서 내보낸 엑셀(.xlsx)이나 카드사·은행 CSV. 자산 현황 시트도 같이 읽어요." onClick={() => fileInput.current?.click()} />
          <Option icon={<ClipboardPaste size={22} />} title="표 붙여넣기" desc="엑셀에서 제목 줄까지 복사해 붙여넣기. 가계부 내역이나 자산 현황(항목·상품명·금액) 표." onClick={() => setPasteOpen(true)} />
        </div>
        <div className="mx-5 mt-6 space-y-2 text-[13px] leading-relaxed text-ink-3">
          <p>· 분류는 ① 내가 만든 규칙 ② 예전에 같은 가게를 넣은 기록 ③ 뱅크샐러드 → 낼나 분류표 순서로 자동으로 맞춰요.</p>
          <p>· 저장 전에 확인하고 고칠 수 있어요. 고친 분류·계좌는 시트 &apos;moneylog 규칙&apos; 탭에 저장돼서 다음부터 자동이에요.</p>
          <p>· 시트에 이미 있는 내역(날짜·금액·내용이 같은 것)은 빼둬요.</p>
          <p>· 자산·부채 현황을 넣으면 시트 &apos;가계부 설정&apos;의 계좌 목록을 뱅크샐러드 이름·금액 그대로 통째로 바꿔요. 예전 계좌 이름을 쓴 기록도 새 이름으로 바꿔요.</p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) load(() => parseSpreadsheetFile(f));
            e.target.value = "";
          }}
        />
        <Sheet open={pasteOpen} onClose={() => setPasteOpen(false)}>
          <div className="px-5 pb-5">
            <p className="text-[17px] font-semibold">표 붙여넣기</p>
            <textarea
              autoFocus
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="날짜	시간	타입	대분류	소분류	내용	금액	화폐	결제수단	메모"
              className="mt-4 h-56 w-full resize-none rounded-2xl bg-surface-2 p-4 text-[14px] outline-none placeholder:text-ink-3"
            />
            <Button
              className="mt-4 w-full"
              disabled={!paste.trim()}
              onClick={() => {
                setPasteOpen(false);
                load(async () => parsePastedText(paste));
                setPaste("");
              }}
            >
              읽어오기
            </Button>
          </div>
        </Sheet>
      </>
    );
  }

  const selected = items.filter((i) => i.selected);
  const needCat = selected.filter((i) => i.draft.kind !== "이동" && !i.draft.category).length;
  const unlinked = [...new Set(items.filter((i) => i.m.needsAccount && i.m.rawAccount).map((i) => i.m.rawAccount!))];
  const resetCount = reset && applyReset ? reset.accounts.length : 0;
  const editingItem = items.find((i) => i.key === editing);

  return (
    <>
      <BackHeader
        title="확인하고 저장"
        href="/import"
        right={
          <button className="text-[15px] text-ink-3" onClick={() => setItems(null)}>
            취소
          </button>
        }
      />
      <div className="px-5 pb-3 text-[14px] leading-relaxed text-ink-3">
        <p className={items.length ? "" : "hidden"}>
          <span className="font-semibold text-ink">{items.length}건</span>을 찾았어요.
          {items.some((i) => i.dup) && ` 시트에 이미 있는 ${items.filter((i) => i.dup).length}건은 빼뒀어요.`}
          {skipped > 0 && ` 읽지 못한 ${skipped}줄은 건너뛰었어요.`}
        </p>
        {needCat > 0 && <p className="text-danger">분류가 필요한 내역 {needCat}건이 있어요. 눌러서 골라 주세요.</p>}
      </div>

      {unlinked.length > 0 && (
        <Card className="mb-3 p-5">
          <p className="text-[15px] font-semibold">결제수단 연결</p>
          <p className="mt-1 text-[13px] text-ink-3">뱅크샐러드 이름을 시트 계좌로 연결하면 다음부터 자동이에요.</p>
          <div className="mt-3 space-y-2">
            {unlinked.map((raw) => (
              <div key={raw} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[14px]">{raw}</span>
                <span className="text-ink-3">→</span>
                <select defaultValue="" onChange={(e) => e.target.value && linkAccount(raw, e.target.value)} className="h-10 w-36 shrink-0 rounded-xl bg-surface-2 px-3 text-[14px] outline-none">
                  <option value="">계좌 선택</option>
                  {accountNames.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Card>
      )}

      {reset && (
        <Card className="mb-3 py-2">
          <div className="flex items-start gap-3 px-5 pt-3 pb-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">자산·부채 목록을 뱅크샐러드로 바꾸기</span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-3">
                시트 &apos;가계부 설정&apos;의 계좌 목록을 아래 {reset.accounts.length}개로 통째로 바꾸고, 잔액이 뱅크샐러드 금액이 되게 시작금액을 맞춰요.
              </span>
            </span>
            <Check3 on={applyReset} onClick={() => setApplyReset(!applyReset)} />
          </div>
          {(["자산", "부채"] as const).map((side) => {
            const list = reset.accounts.filter((a) => a.kind === side);
            if (!list.length) return null;
            return (
              <div key={side} className={applyReset ? "" : "opacity-40"}>
                <p className="px-5 pt-2 pb-1 text-[12px] font-semibold text-ink-3">{side}</p>
                {list.map((a) => (
                  <div key={a.name} className="flex items-center gap-3 px-5 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">{a.name}</span>
                      <span className="block truncate text-[12px] text-ink-3">
                        {[a.category, a.subcategory].filter(Boolean).join(" › ")}
                        {a.renamedFrom && <span className="text-accent"> · 예전 &apos;{a.renamedFrom}&apos;</span>}
                      </span>
                    </span>
                    <span className={`num shrink-0 text-[14px] font-medium ${side === "부채" ? "text-danger" : ""}`}>{formatNumber(a.balance)}</span>
                  </div>
                ))}
              </div>
            );
          })}
          {applyReset && (reset.renames.length > 0 || reset.removed.length > 0) && (
            <div className="mx-5 my-2 space-y-1 rounded-2xl bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-ink-2">
              {reset.renames.length > 0 && <p>이름이 바뀌는 계좌 {reset.renames.length}개는 예전 기록 속 이름도 같이 바꿔요.</p>}
              {reset.removed.length > 0 && (
                <p>
                  목록에서 빠지는 계좌: {reset.removed.join(", ")}
                  <span className="text-ink-3"> (그 계좌를 쓴 예전 기록은 남지만 잔고에는 안 잡혀요)</span>
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {items.length > 0 && (
        <Card className="py-2">
          {items.map((it) => (
            <RecordRow
              key={it.key}
              r={it.draft}
              onClick={() => setEditing(it.key)}
              leading={<Check3 on={it.selected} onClick={() => setItems((l) => l!.map((x) => (x.key === it.key ? { ...x, selected: !x.selected } : x)))} />}
              note={
                <span className={`text-[11px] ${it.dup ? "text-ink-3" : it.draft.kind !== "이동" && !it.draft.category ? "text-danger" : "text-ink-3"}`}>
                  {it.dup ? "이미 있음" : it.draft.kind !== "이동" && !it.draft.category ? "분류 필요" : `${it.draft.date.slice(5).replace("-", ".")} · ${it.m.how}`}
                </span>
              }
            />
          ))}
        </Card>
      )}

      {error && <p className="mx-4 mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger">{error}</p>}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-20 mx-auto max-w-md bg-gradient-to-t from-bg via-bg to-transparent px-4 pt-6 pb-3">
        <Button className="w-full" disabled={(!selected.length && !resetCount) || needCat > 0} onClick={save}>
          {[selected.length && `${selected.length}건`, resetCount && `계좌 ${resetCount}개`].filter(Boolean).join(" · ") || "0건"} 시트에 저장
        </Button>
      </div>
      <div className="h-24" />

      <RecordSheet
        open={!!editingItem}
        settings={settings}
        initial={editingItem?.draft}
        saveLabel="수정"
        onClose={() => setEditing(null)}
        onSave={async (d) => {
          const it = editingItem!;
          if (d.kind !== "이동" && d.category && d.content && (d.category !== it.m.draft.category || d.subcategory !== it.m.draft.subcategory)) {
            remember({ type: "가맹점", source: d.content, category: d.category, subcategory: d.subcategory ?? "" });
          }
          const acc = d.kind === "수입" ? d.inAccount : d.outAccount;
          if (it.m.rawAccount && acc && acc !== (it.m.draft.kind === "수입" ? it.m.draft.inAccount : it.m.draft.outAccount)) {
            remember({ type: "계좌", source: it.m.rawAccount, category: acc, subcategory: "" });
          }
          setItems((l) => l!.map((x) => (x.key === it.key ? { ...x, draft: d, selected: true } : x)));
        }}
        onDelete={async () => setItems((l) => l!.filter((x) => x.key !== editing))}
      />
    </>
  );
}

function Check3({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <span
      role="checkbox"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${on ? "border-ink bg-ink text-surface" : "border-line"}`}
    >
      {on && <Check size={14} strokeWidth={3} />}
    </span>
  );
}

function Option({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mx-4 flex w-[calc(100%-2rem)] items-start gap-4 rounded-3xl bg-surface p-5 text-left active:scale-[0.99]">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</span>
      <span>
        <span className="block text-[16px] font-semibold">{title}</span>
        <span className="mt-1 block text-[13px] leading-snug text-ink-3">{desc}</span>
      </span>
    </button>
  );
}
