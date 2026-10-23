import { describe, expect, it } from "vitest";
import { parseDelimited } from "./file";
import { parseTable } from "./table";

// 사용자가 보내준 실제 뱅크샐러드 내보내기 형식 (탭 구분)
const SAMPLE = [
  "날짜\t시간\t타입\t대분류\t소분류\t내용\t금액\t화폐\t결제수단\t메모",
  "2026-10-22\t18:29\t지출\t카페/간식\t베이커리\t스탠다드 브레드\t-12500\tKRW\t신세계이마트 삼성카드 SFC 7\t",
  "2026-10-22\t17:33\t지출\t식비\t일식\t주식회사 츠지한코리아(츠지한 압구정)\t-41000\tKRW\t신세계이마트 삼성카드 SFC 7\t",
  "2026-10-22\t16:40\t이체\t카드대금\t미분류\t삼성카드\t-1331429\tKRW\t우리 드림하이 통장\t",
  "2026-10-22\t15:23\t지출\t카페/간식\t커피/음료\t워커스하이\t-600\tKRW\t네이버 현대카드\t",
  "2026-10-22\t08:33\t지출\t카페/간식\t커피/음료\t카페아이엠티 여의도 전경련점\t-11600\tKRW\t신세계이마트 삼성카드 SFC 7\t",
  "2026-10-21\t13:00\t이체\t내계좌이체\t미분류\t카카오페이\t-10000\tKRW\t우리 드림하이 통장\t",
].join("\n");

describe("뱅크샐러드 실제 형식", () => {
  it("탭으로 구분된 내역을 그대로 읽는다", () => {
    const result = parseTable(parseDelimited(SAMPLE))!;
    expect(result.skipped).toBe(0);
    expect(result.rows).toHaveLength(6);
    expect(result.rows[0]).toEqual({
      date: "2026-10-22",
      time: "18:29",
      type: "expense",
      amount: 12500,
      merchant: "스탠다드 브레드",
      category: "카페/간식",
      subcategory: "베이커리",
      method: "신세계이마트 삼성카드 SFC 7",
      memo: undefined,
    });
    expect(result.rows[2]).toMatchObject({ type: "transfer", amount: 1331429, category: "카드대금", subcategory: undefined });
    expect(result.rows[5]).toMatchObject({ date: "2026-10-21", time: "13:00", type: "transfer", category: "내계좌이체" });
  });
});
