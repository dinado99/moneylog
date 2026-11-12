import { describe, expect, it } from "vitest";
import { withAsOf } from "./import/accounts-reset";
import { formatFx, fxOf, toWon, withFx } from "./fx";

describe("외화 메모", () => {
  it("메모에 외화를 넣고 읽는다 (다른 메모·잔액기준은 그대로)", () => {
    const memo = withFx("주거래 · 잔액기준 2026-11-01", [
      { currency: "USD", amount: 120.5 },
      { currency: "JPY", amount: 3000 },
    ]);
    expect(memo).toBe("주거래 · 잔액기준 2026-11-01 · 외화 USD 120.5, JPY 3000");
    expect(fxOf(memo)).toEqual([
      { currency: "USD", amount: 120.5 },
      { currency: "JPY", amount: 3000 },
    ]);
    expect(withFx(memo, [])).toBe("주거래 · 잔액기준 2026-11-01");
    // 잔액기준을 바꿔도 외화는 남는다
    expect(fxOf(withAsOf(memo, "2026-11-10"))).toHaveLength(2);
    expect(withAsOf("잔액기준 2026-11-01 · 외화 USD 1", "2026-11-10")).toBe("외화 USD 1 · 잔액기준 2026-11-10");
  });

  it("표시와 원화 환산", () => {
    expect(formatFx({ currency: "USD", amount: 1234.5 })).toBe("$1,234.5");
    expect(formatFx({ currency: "JPY", amount: 3000 })).toBe("¥3,000");
    expect(toWon([{ currency: "USD", amount: 10 }, { currency: "JPY", amount: 1000 }], { USD: 1400, JPY: 9.2 })).toBe(23200);
    expect(toWon([{ currency: "USD", amount: 10 }], undefined)).toBeNull();
  });
});

import { fromSheetRow, toSheetRow } from "./record-key";
import { parseDelimited } from "./import/file";
import { parseTable } from "./import/table";

describe("외화로 쓴 내역", () => {
  it("시트에는 원화 + 내용 뒤 (USD 12.5), 읽으면 다시 나뉜다", () => {
    const d = { date: "2026-11-12", kind: "지출" as const, category: "🍽️ 식비", content: "점심", amount: 17500, outAccount: "트래블월렛", fx: { currency: "USD", amount: 12.5 } };
    const row = toSheetRow(d);
    expect(row[4]).toBe("점심 (USD 12.5)");
    expect(row[5]).toBe("17500");
    expect(fromSheetRow(row)).toMatchObject({ content: "점심", amount: 17500, fx: { currency: "USD", amount: 12.5 } });
    expect(fromSheetRow(toSheetRow({ ...d, fx: undefined })).fx).toBeUndefined();
  });

  it("뱅크샐러드 화폐가 원화가 아니면 소수 그대로 외화로 읽는다", () => {
    const t = parseTable(
      parseDelimited("날짜\t시간\t타입\t대분류\t소분류\t내용\t금액\t화폐\t결제수단\t메모\n2026-11-12\t12:00\t지출\t식비\t외식비\t점심\t-12.5\tUSD\t트래블월렛\t\n2026-11-12\t13:00\t지출\t식비\t외식비\t저녁\t-9000\tKRW\t현대카드\t"),
    )!.rows;
    expect([t[0].amount, t[0].currency]).toEqual([12.5, "USD"]);
    expect([t[1].amount, t[1].currency]).toEqual([9000, undefined]);
  });
});

import { costRate, fxLedger, holdingsOf } from "./fx";

describe("외화 충전·사용", () => {
  const recs = [
    // 우리은행에서 하나머니로 USD 100 충전 (원화 140,000 이동)
    { date: "2026-11-01", kind: "이동", amount: 140000, outAccount: "우리은행", inAccount: "하나머니", fx: { currency: "USD", amount: 100 } },
    { date: "2026-11-02", kind: "이동", amount: 72000, outAccount: "우리은행", inAccount: "하나머니", fx: { currency: "USD", amount: 50 } },
    // 여행 가서 하나머니로 $12.5 지출
    { date: "2026-11-10", kind: "지출", amount: 17750, outAccount: "하나머니", fx: { currency: "USD", amount: 12.5 } },
    // 남은 $20를 원화로 다시 바꿈
    { date: "2026-11-12", kind: "이동", amount: 28000, outAccount: "하나머니", inAccount: "우리은행", fx: { currency: "USD", amount: -20 } },
  ];

  it("충전은 들어오고, 쓰면 나가고, 되팔면 나간다 (우리은행은 원화라 외화 변동 없음)", () => {
    const l = fxLedger(recs);
    expect(holdingsOf("", l.get("하나머니"))).toEqual([{ currency: "USD", amount: 117.5 }]);
    expect(l.get("우리은행")).toBeUndefined();
    // 메모의 시작 외화와 합쳐진다
    expect(holdingsOf("외화 USD 10, JPY 500", l.get("하나머니"))).toEqual([
      { currency: "USD", amount: 127.5 },
      { currency: "JPY", amount: 500 },
    ]);
  });

  it("평균 충전 환율 = 낸 원화 ÷ 받은 외화", () => {
    const l = fxLedger(recs);
    expect(costRate(l.get("하나머니"), "USD")).toBeCloseTo(212000 / 150);
    expect(costRate(l.get("하나머니"), "JPY")).toBeNull();
  });
});
