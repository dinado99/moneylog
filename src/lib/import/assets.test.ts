import { describe, expect, it } from "vitest";
import { parseAssetTable } from "./assets";
import { parseDelimited } from "./file";

// 사용자가 보내준 뱅크샐러드 자산 현황 (탭 구분, 항목은 병합 셀)
const SAMPLE = `항목\t상품명\t\t금액
자유입출금 자산\tNH주거래우대통장(비대면실명확인)\t\t1
\t세이프박스\t\t0
\t신한 주거래 S20통장\t\t33
\t우리 드림하이 통장\t\t2,579,815
\t입출금통장\t\t0
\t저금통\t\t548
\t직장인우대통장-저축예금\t\t72
\t토스뱅크 통장\t\t6
신탁 자산\t\t\t
현금 자산\t현금\t\t0
저축성 자산\t청년 주택드림 청약통장\t\t8,825,000
전자금융 자산\t네이버페이 머니 - wlsd****\t\t606
\t카카오페이 머니 - 010*****096\t\t0
\t토스머니\t\t0
\t페이코포인트 - wl******@naver.com\t\t2,750`;

describe("parseAssetTable", () => {
  it("뱅크샐러드 자산 현황을 읽는다", () => {
    const rows = parseAssetTable(parseDelimited(SAMPLE));
    expect(rows).toHaveLength(14);
    expect(rows[0]).toEqual({ kind: "자유입출금 자산", name: "NH주거래우대통장(비대면실명확인)", balance: 1 });
    expect(rows[3]).toEqual({ kind: "자유입출금 자산", name: "우리 드림하이 통장", balance: 2579815 });
    expect(rows.find((r) => r.name === "현금")).toEqual({ kind: "현금 자산", name: "현금", balance: 0 });
    expect(rows.find((r) => r.kind === "저축성 자산")).toEqual({ kind: "저축성 자산", name: "청년 주택드림 청약통장", balance: 8825000 });
    expect(rows.slice(-4).map((r) => r.name)).toEqual(["네이버페이 머니", "카카오페이 머니", "토스머니", "페이코포인트"]);
  });

  it("거래 내역 표에서는 아무것도 찾지 않는다", () => {
    expect(parseAssetTable(parseDelimited("날짜\t금액\n2026-10-01\t100"))).toEqual([]);
  });
});
