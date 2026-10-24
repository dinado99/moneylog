import { describe, expect, it } from "vitest";
import type { RecordRow } from "./db";
import { keyOfRow, toSheetRow, type SheetRow } from "./record-key";
import { diffWithSheet, pendingOps } from "./sync";

let n = 0;
function row(p: Partial<RecordRow>): RecordRow {
  return {
    id: `r${++n}`,
    date: "2026-10-01",
    kind: "지출",
    category: "🍽️ 식비",
    subcategory: "커피",
    content: "스벅",
    amount: 5000,
    in_account: null,
    out_account: "현대카드",
    source: "app",
    sheet_key: null,
    synced: false,
    deleted: false,
    created_at: "",
    ...p,
  };
}
const sheetRow = (r: RecordRow): SheetRow =>
  toSheetRow({ date: r.date, kind: r.kind, category: r.category ?? undefined, subcategory: r.subcategory ?? undefined, content: r.content, amount: r.amount, inAccount: r.in_account ?? undefined, outAccount: r.out_account ?? undefined });

describe("pendingOps", () => {
  it("추가·수정·삭제를 시트 작업으로 만든다", () => {
    const synced = row({ synced: true });
    synced.sheet_key = keyOfRow(sheetRow(synced));
    const edited = row({ amount: 6000, sheet_key: synced.sheet_key, synced: false });
    const added = row({});
    const gone = row({ deleted: true, sheet_key: '["x"]' });
    const neverPushed = row({ deleted: true });
    const { ops, dropIds } = pendingOps([synced, edited, added, gone, neverPushed]);
    expect(ops.map((o) => o.op.op)).toEqual(["update", "add", "delete"]);
    expect(ops[0].op).toMatchObject({ match: synced.sheet_key });
    expect(ops[0].key).toBe(keyOfRow(sheetRow(edited)));
    expect(dropIds).toEqual([neverPushed.id]);
  });
});

describe("diffWithSheet", () => {
  it("시트 기준으로 추가·삭제를 정한다 (같은 줄 여러 개는 개수로)", () => {
    const a = row({ synced: true });
    a.sheet_key = keyOfRow(sheetRow(a));
    const a2 = row({ synced: true, sheet_key: a.sheet_key });
    const b = row({ synced: true, content: "지운줄" });
    b.sheet_key = keyOfRow(sheetRow(b));
    const pending = row({ content: "아직 못 보냄" });
    const pcAdded: SheetRow = ["2026-10-02", "수입", "👷 근로소득", "급여", "월급", "3000000", "우리은행", ""];
    const { removeIds, add } = diffWithSheet([a, a2, b, pending], [sheetRow(a), pcAdded]);
    expect(removeIds.sort()).toEqual([a2.id, b.id].sort());
    expect(add).toHaveLength(1);
    expect(add[0].draft).toMatchObject({ kind: "수입", amount: 3000000, inAccount: "우리은행", outAccount: undefined });
  });
});
