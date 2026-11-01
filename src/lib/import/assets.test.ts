import { describe, expect, it } from "vitest";
import { parseAssetTable } from "./assets";
import { parseDelimited } from "./file";

// 사용자가 보내준 뱅크샐러드 자산 현황 (탭 구분, 항목은 병합 셀)
const SAMPLE = `항목\t상품명\t\t금액
자유입출금 자산\tNH주거래우대통장(비대면실명확인)\t\t1
\t세이프박스\t\t0
\t우리 드림하이 통장\t\t2,579,815
신탁 자산\t\t\t
현금 자산\t현금\t\t0
저축성 자산\t청년 주택드림 청약통장\t\t8,825,000
전자금융 자산\t네이버페이 머니 - wlsd****\t\t606`;

describe("parseAssetTable", () => {
  it("자산 표", () => {
    const rows = parseAssetTable(parseDelimited(SAMPLE));
    expect(rows).toHaveLength(6);
    expect(rows[2]).toEqual({ side: "자산", kind: "자유입출금 자산", name: "우리 드림하이 통장", balance: 2579815 });
    expect(rows.at(-1)).toEqual({ side: "자산", kind: "전자금융 자산", name: "네이버페이 머니", balance: 606 });
  });

  it("오른쪽 부채 표도 읽는다", () => {
    const text = [
      "자산\t\t\t\t\t부채",
      "항목\t상품명\t\t금액\t\t항목\t상품명\t금액",
      "자유입출금 자산\t우리 드림하이 통장\t\t2,579,815\t\t카드\t신세계이마트 삼성카드\t-153,132",
      "\t토스뱅크 통장\t\t6\t\t\t현대카드 M\t25,332",
      "저축성 자산\t청년 주택드림 청약통장\t\t8,825,000\t\t대출\t학자금대출\t1,000,000",
    ].join("\n");
    const rows = parseAssetTable(parseDelimited(text));
    expect(rows.filter((r) => r.side === "자산").map((r) => r.name)).toEqual(["우리 드림하이 통장", "토스뱅크 통장", "청년 주택드림 청약통장"]);
    expect(rows.filter((r) => r.side === "부채")).toEqual([
      { side: "부채", kind: "카드", name: "신세계이마트 삼성카드", balance: 153132 },
      { side: "부채", kind: "카드", name: "현대카드 M", balance: 25332 },
      { side: "부채", kind: "대출", name: "학자금대출", balance: 1000000 },
    ]);
  });

  it("거래 내역 표에서는 아무것도 찾지 않는다", () => {
    expect(parseAssetTable(parseDelimited("날짜\t금액\n2026-10-01\t100"))).toEqual([]);
  });
});
