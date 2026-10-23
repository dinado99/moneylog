import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "../defaults";
import type { Settings } from "../settings-db";
import { mapDraft } from "./map";
import { parseDelimited } from "./file";
import { parseTable } from "./table";

function defaultSettings(): Settings {
  const categories: Settings["categories"] = [];
  DEFAULT_CATEGORIES.forEach((c, i) => {
    const id = `m${i}`;
    categories.push({ id, type: c.type, parent_id: null, name: c.name, emoji: c.emoji, sort: i });
    c.subs.forEach((name, j) => categories.push({ id: `${id}-${j}`, type: c.type, parent_id: id, name, emoji: null, sort: j }));
  });
  return {
    categories,
    groups: [{ id: "g1", name: "신용카드", emoji: "💳", sort: 0 }],
    assets: [{ id: "a1", group_id: "g1", name: "삼성SFC카드", aliases: ["신세계이마트 삼성카드 SFC 7"], sort: 0, balance: null, balance_updated_at: null }],
  };
}

const SAMPLE = [
  "날짜\t시간\t타입\t대분류\t소분류\t내용\t금액\t화폐\t결제수단\t메모",
  "2026-10-22\t18:29\t지출\t카페/간식\t베이커리\t스탠다드 브레드\t-12500\tKRW\t신세계이마트 삼성카드 SFC 7\t",
  "2026-10-22\t17:33\t지출\t식비\t일식\t주식회사 츠지한코리아(츠지한 압구정)\t-41000\tKRW\t신세계이마트 삼성카드 SFC 7\t",
  "2026-10-22\t16:40\t이체\t카드대금\t미분류\t삼성카드\t-1331429\tKRW\t우리 드림하이 통장\t",
  "2026-10-22\t15:23\t지출\t카페/간식\t커피/음료\t워커스하이\t-600\tKRW\t네이버 현대카드\t",
  "2026-10-21\t13:00\t이체\t내계좌이체\t미분류\t카카오페이\t-10000\tKRW\t우리 드림하이 통장\t",
].join("\n");

describe("뱅크샐러드 → 내 분류/자산", () => {
  const s = defaultSettings();
  const rows = parseTable(parseDelimited(SAMPLE))!.rows.map((d) => mapDraft(s, d));

  it("분류를 바꾼다", () => {
    expect(rows.map((r) => [r.category, r.subcategory])).toEqual([
      ["식비", "간식/카페"],
      ["식비", "외식/배달비"],
      ["카드대금", undefined],
      ["식비", "간식/카페"],
      ["내계좌이체", undefined],
    ]);
  });

  it("결제수단 별칭을 자산 이름으로 바꾸고, 모르는 건 그대로 둔다", () => {
    expect(rows[0].method).toBe("삼성SFC카드");
    expect(rows[3].method).toBe("네이버 현대카드");
  });

  it("이미 내 분류 이름이면 그대로, 수입은 기본 분류로", () => {
    expect(mapDraft(s, { date: "2026-10-01", type: "expense", amount: 1, merchant: "x", category: "통신비", subcategory: "핸드폰요금" })).toMatchObject({
      category: "통신비",
      subcategory: "핸드폰요금",
    });
    expect(mapDraft(s, { date: "2026-10-01", type: "income", amount: 1, merchant: "x", category: "급여" })).toMatchObject({
      category: "근로소득",
      subcategory: "급여",
    });
    expect(mapDraft(s, { date: "2026-10-01", type: "expense", amount: 1, merchant: "x", category: "알수없음" }).category).toBe("알수없음");
  });
});
