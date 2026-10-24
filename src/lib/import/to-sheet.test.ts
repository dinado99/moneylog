import { describe, expect, it } from "vitest";
import type { SheetSettings } from "../types";
import { parseDelimited } from "./file";
import { parseTable } from "./table";
import { makeMapper } from "./to-sheet";

// 보내준 엑셀 '가계부 설정' 일부
const settings = {
  startYear: 2025,
  fiscalMonth: 1,
  schedules: [],
  categories: [
    { kind: "지출", name: "🍽️ 식비", subs: ["식자재구입비", "외식비", "회사 식사비", "배달식비", "간식비", "커피", "기타식비"].map((name) => ({ name, fixed: false })) },
    { kind: "지출", name: "💻 IT서비스이용료", subs: ["OTT구독료", "기타서비스이용료"].map((name) => ({ name, fixed: false })) },
    { kind: "수입", name: "💵 금융소득", subs: [{ name: "이자소득", fixed: true }] },
  ],
  accounts: [
    { sort: 1, kind: "자산", category: "💰현금·예금", subcategory: "입출금통장", name: "우리은행", start: 0, memo: "", hidden: false },
    { sort: 2, kind: "자산", category: "💰현금·예금", subcategory: "입출금통장", name: "카카오페이", start: 0, memo: "", hidden: false },
    { sort: 3, kind: "부채", category: "💳 신용카드", subcategory: "일시불", name: "삼성SFC카드", start: 0, memo: "", hidden: false },
    { sort: 4, kind: "부채", category: "💳 신용카드", subcategory: "일시불", name: "현대카드", start: 0, memo: "", hidden: false },
    { sort: 5, kind: "자산", category: "📈 저축·투자", subcategory: "주식", name: "삼성증권 주식", start: 0, memo: "", hidden: false },
  ],
} as SheetSettings;

const SAMPLE = [
  "날짜\t시간\t타입\t대분류\t소분류\t내용\t금액\t화폐\t결제수단\t메모",
  "2026-10-22\t18:29\t지출\t카페/간식\t베이커리\t스탠다드 브레드\t-12500\tKRW\t신세계이마트 삼성카드 SFC 7\t",
  "2026-10-22\t17:33\t지출\t식비\t일식\t주식회사 츠지한코리아(츠지한 압구정)\t-41000\tKRW\t신세계이마트 삼성카드 SFC 7\t",
  "2026-10-22\t16:40\t이체\t카드대금\t미분류\t삼성카드\t-1331429\tKRW\t우리 드림하이 통장\t",
  "2026-10-22\t15:23\t지출\t카페/간식\t커피/음료\t워커스하이\t-600\tKRW\t네이버 현대카드\t",
  "2026-10-21\t13:00\t이체\t내계좌이체\t미분류\t카카오페이\t-10000\tKRW\t우리 드림하이 통장\t",
  "2026-10-20\t09:00\t지출\t문화/여가\t구독\t아이클라우드\t-1100\tKRW\t네이버 현대카드\t",
].join("\n");

describe("뱅크샐러드 → 시트 분류·계좌", () => {
  const rows = parseTable(parseDelimited(SAMPLE))!.rows;

  it("기본표로 분류하고 결제수단을 시트 계좌로 맞춘다", () => {
    const map = makeMapper(settings, [], []);
    const out = rows.map(map);
    expect(out.map((m) => [m.draft.kind, m.draft.category, m.draft.subcategory, m.draft.outAccount, m.draft.inAccount])).toEqual([
      ["지출", "🍽️ 식비", "간식비", "삼성SFC카드", undefined],
      ["지출", "🍽️ 식비", "외식비", "삼성SFC카드", undefined],
      ["이동", undefined, undefined, undefined, "삼성SFC카드"],
      ["지출", "🍽️ 식비", "커피", "현대카드", undefined],
      ["이동", undefined, undefined, undefined, "카카오페이"],
      ["지출", "💻 IT서비스이용료", "OTT구독료", "현대카드", undefined],
    ]);
    // "우리 드림하이 통장"은 이름만으로는 우리은행인지 모름 → 확인 필요
    expect(out[2].needsAccount).toBe(true);
  });

  it("규칙과 예전 기록이 기본표보다 먼저", () => {
    const map = makeMapper(
      settings,
      [{ id: "x", key: "x", date: "2026-09-01", kind: "지출", category: "🍽️ 식비", subcategory: "회사 식사비", content: "주식회사 츠지한코리아(츠지한 압구정)", amount: 1 }],
      [
        { type: "가맹점", source: "브레드", category: "🍽️ 식비", subcategory: "기타식비" },
        { type: "계좌", source: "우리 드림하이 통장", category: "우리은행", subcategory: "" },
      ],
    );
    const out = rows.map(map);
    expect([out[0].draft.subcategory, out[0].how]).toEqual(["기타식비", "규칙"]);
    expect([out[1].draft.subcategory, out[1].how]).toEqual(["회사 식사비", "예전 기록"]);
    expect(out[2].draft.outAccount).toBe("우리은행");
  });
});
