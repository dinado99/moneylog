import type { RecordRow } from "./db";
import { fromSheetRow, keyOfRow, toSheetRow, type SheetRow } from "./record-key";
import type { SheetOp } from "./sheet";
import type { RecordDraft } from "./types";

const draftOf = (r: RecordRow): RecordDraft => ({
  date: r.date,
  kind: r.kind,
  category: r.category ?? undefined,
  subcategory: r.subcategory ?? undefined,
  content: r.content,
  amount: Number(r.amount),
  inAccount: r.in_account ?? undefined,
  outAccount: r.out_account ?? undefined,
});

/** 앱에서 바뀐 것 → 시트에 보낼 작업. 시트에 없던 지운 줄은 바로 지우면 된다(dropIds). */
export function pendingOps(rows: RecordRow[]) {
  const ops: { id: string; op: SheetOp; deleted: boolean; key: string | null }[] = [];
  const dropIds: string[] = [];
  for (const r of rows) {
    if (r.synced) continue;
    if (r.deleted) {
      if (r.sheet_key) ops.push({ id: r.id, op: { op: "delete", match: r.sheet_key }, deleted: true, key: null });
      else dropIds.push(r.id);
      continue;
    }
    const row = toSheetRow(draftOf(r));
    ops.push({
      id: r.id,
      op: r.sheet_key ? { op: "update", match: r.sheet_key, row } : { op: "add", row },
      deleted: false,
      key: keyOfRow(row),
    });
  }
  return { ops, dropIds };
}

/**
 * 시트 기준으로 맞추기. 이미 시트와 맞춰진 행(synced)만 비교하고, 아직 못 보낸 변경은 건드리지 않는다.
 * - 시트에 있는데 앱에 없으면 → 추가 (PC에서 추가·수정한 줄)
 * - 앱에 있는데 시트에 없으면 → 삭제 (PC에서 지우거나 고친 줄)
 * 같은 내용의 줄이 여러 개일 수 있어 개수로 비교한다.
 */
export function diffWithSheet(rows: RecordRow[], sheet: SheetRow[]) {
  const sheetCounts = new Map<string, { row: SheetRow; n: number }>();
  for (const row of sheet) {
    const k = keyOfRow(row);
    const cur = sheetCounts.get(k);
    if (cur) cur.n++;
    else sheetCounts.set(k, { row, n: 1 });
  }
  const removeIds: string[] = [];
  for (const r of rows) {
    if (!r.synced || r.deleted || !r.sheet_key) continue;
    const hit = sheetCounts.get(r.sheet_key);
    if (hit && hit.n > 0) hit.n--;
    else removeIds.push(r.id);
  }
  const add: { draft: RecordDraft; key: string }[] = [];
  for (const [key, { row, n }] of sheetCounts) for (let i = 0; i < n; i++) add.push({ draft: fromSheetRow(row), key });
  return { removeIds, add };
}
