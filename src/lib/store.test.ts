import { describe, expect, it } from "vitest";
import { keyOfRow, type SheetRow } from "./record-key";
import { applyOps, toRecords } from "./store";

const a: SheetRow = ["2026-10-02", "지출", "🍽️ 식비", "커피", "스벅", "5000", "", "현대카드"];
const b: SheetRow = ["2026-10-01", "수입", "👷 근로소득", "급여", "월급", "3000000", "우리은행", ""];

describe("store", () => {
  it("같은 내용 줄도 화면에서 구분된다", () => {
    const recs = toRecords([a, a, b]);
    expect(recs.map((r) => r.id.split("#")[1])).toEqual(["1", "2", "1"]);
    expect(recs[2]).toMatchObject({ kind: "수입", amount: 3000000, inAccount: "우리은행", outAccount: undefined });
  });

  it("추가·수정·삭제를 받아 둔 데이터에 적용하고 날짜순 정렬", () => {
    const c: SheetRow = ["2026-09-30", "지출", "🚌 교통비", "택시비", "택시", "12000", "", "현대카드"];
    const next = applyOps(
      [a, a, b],
      [
        { op: "add", row: c },
        { op: "update", match: keyOfRow(a), row: [...a.slice(0, 5), "6000", "", "현대카드"] as SheetRow },
        { op: "delete", match: keyOfRow(b) },
      ],
    );
    expect(next.map((r) => `${r[0]} ${r[4]} ${r[5]}`)).toEqual(["2026-09-30 택시 12000", "2026-10-02 스벅 6000", "2026-10-02 스벅 5000"]);
  });
});
