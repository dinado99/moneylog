import { readFileSync } from "node:fs";
import { join } from "node:path";
import readXlsxFile from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { parseDate, parseTable, type Cell } from "./table";

describe("parseTable", () => {
  it("뱅크샐러드 내보내기 엑셀을 읽는다", async () => {
    const sheets = await readXlsxFile(readFileSync(join(__dirname, "__fixtures__/banksalad-sample.xlsx")));
    const sheet = sheets.find((s) => s.sheet === "가계부 내역")!;
    const result = parseTable(sheet.data as unknown as Cell[][])!;

    expect(result.skipped).toBe(0);
    expect(result.rows).toHaveLength(7);
    expect(result.rows[0]).toEqual({
      date: "2026-10-21",
      time: "12:31",
      type: "expense",
      amount: 8500,
      merchant: "김밥천국 강남점",
      category: "식비",
      subcategory: "한식",
      method: "신한카드",
      memo: undefined,
    });
    expect(result.rows.find((r) => r.merchant === "(주)회사 급여")).toMatchObject({ type: "income", amount: 3200000, category: "급여" });
    expect(result.rows.find((r) => r.merchant === "내 저축계좌")).toMatchObject({ type: "transfer", amount: 500000 });
    expect(result.rows.find((r) => r.merchant === "쿠팡")?.memo).toBe("휴지");
  });

  it("요약 시트처럼 헤더가 없으면 null", () => {
    expect(parseTable([["요약"], ["총 자산", 100]])).toBeNull();
  });

  it("카드사 CSV 형태(양수 금액 = 지출)", () => {
    const result = parseTable([
      ["이용일자", "이용가맹점", "이용금액", "카드"],
      ["2026.10.20", "GS25 역삼점", "4,200", "삼성카드"],
      ["2026.10.19", "배달의민족", "23,000", "삼성카드"],
      ["합계", "", "27,200", ""],
    ])!;
    expect(result.rows).toEqual([
      expect.objectContaining({ date: "2026-10-20", merchant: "GS25 역삼점", amount: 4200, type: "expense", category: "생활", method: "삼성카드" }),
      expect.objectContaining({ date: "2026-10-19", merchant: "배달의민족", amount: 23000, type: "expense", category: "식비" }),
    ]);
    expect(result.skipped).toBe(1);
  });

  it("은행 입출금 내역(출금/입금 컬럼)", () => {
    const result = parseTable([
      ["거래일시", "적요", "출금액", "입금액", "잔액"],
      ["2026-10-01 09:12:00", "월세", "500,000", "0", "1,000,000"],
      ["2026-10-02 10:00:00", "이자", "0", "1,234", "1,001,234"],
    ])!;
    expect(result.rows).toEqual([
      expect.objectContaining({ date: "2026-10-01", time: "09:12", merchant: "월세", amount: 500000, type: "expense" }),
      expect.objectContaining({ date: "2026-10-02", time: "10:00", merchant: "이자", amount: 1234, type: "income", category: "기타수입" }),
    ]);
  });
});

describe("parseDate", () => {
  it.each([
    ["2026.10.03", "2026-10-03"],
    ["2026년 10월 3일", "2026-10-03"],
    ["20261003", "2026-10-03"],
    ["26/10/03", "2026-10-03"],
    ["10/03", "2026-10-03"],
  ])("%s", (input, expected) => {
    expect(parseDate(input, 2026)).toBe(expected);
  });
});
