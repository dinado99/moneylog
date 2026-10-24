import { describe, expect, it } from "vitest";
import { balances, byCategory, fiscalMonths, fixedSet, fixedSplit, netWorth, scheduleDay } from "./analytics";
import type { Account, RecordDraft, SheetSettings } from "./types";

// 보내준 엑셀의 계좌 일부와 기록 4줄
const acc = (name: string, kind: "자산" | "부채", category: string, subcategory: string, start: number): Account => ({
  sort: 0, kind, category, subcategory, name, start, memo: "", hidden: false,
});
const accounts = [
  acc("우리은행", "자산", "💰현금·예금", "입출금통장", 193435),
  acc("카카오페이", "자산", "💰현금·예금", "입출금통장", 300601),
  acc("청년주택청약", "자산", "📈 저축·투자", "예적금", 7425000),
  acc("현대카드", "부채", "💳 신용카드", "일시불", 127500),
  acc("현대카드", "부채", "💳 신용카드", "할부", 0),
  acc("삼성SFC카드", "부채", "💳 신용카드", "일시불", 0),
];
const records: RecordDraft[] = [
  { date: "2025-09-01", kind: "이동", content: "청년주택청약", amount: 100000, inAccount: "청년주택청약", outAccount: "우리은행" },
  { date: "2025-09-01", kind: "수입", category: "💵 금융소득", subcategory: "이자소득", content: "정기예탁금수익", amount: 33, inAccount: "카카오페이" },
  { date: "2025-09-01", kind: "지출", category: "👗 의류비", subcategory: "의복구입비", content: "TEMU", amount: 25332, outAccount: "현대카드" },
  { date: "2025-09-01", kind: "지출", category: "🍽️ 식비", subcategory: "간식비", content: "회사 자판기", amount: 300, outAccount: "삼성SFC카드" },
];

describe("잔고 (엑셀 '잔고 보고서'와 같은 값)", () => {
  const b = Object.fromEntries(balances(accounts, records).map((a) => [a.name, a.balance]));
  it("계좌별 잔액", () => {
    expect(b["우리은행"]).toBe(93435);
    expect(b["카카오페이"]).toBe(300634);
    expect(b["청년주택청약"]).toBe(7525000);
    expect(b["현대카드"]).toBe(152832);
    expect(b["삼성SFC카드"]).toBe(300);
  });
  it("기간 전 잔액과 순자산", () => {
    const before = balances(accounts, records, "2025-08-31");
    expect(before.find((a) => a.name === "우리은행")!.balance).toBe(193435);
    expect(netWorth(balances(accounts, records))).toEqual({ assets: 93435 + 300634 + 7525000, debts: 152832 + 300, net: 93435 + 300634 + 7525000 - 153132 });
  });
});

describe("분류·고정비", () => {
  const settings = {
    categories: [{ kind: "지출", name: "👗 의류비", subs: [{ name: "의복구입비", fixed: true }] }],
  } as unknown as SheetSettings;
  it("대분류별 합계와 고정/변동", () => {
    expect(byCategory(records, "지출").map((c) => [c.name, c.total])).toEqual([["👗 의류비", 25332], ["🍽️ 식비", 300]]);
    expect(fixedSplit(records, "지출", fixedSet(settings))).toEqual({ fixed: 25332, variable: 300 });
  });
});

describe("달력·회계연도", () => {
  it("주말이면 당기기/밀기", () => {
    // 2026-11-21 토요일, 2026-11-22 일요일
    expect(scheduleDay(21, "당기기", "2026-11")).toBe(20);
    expect(scheduleDay(22, "밀기", "2026-11")).toBe(23);
    expect(scheduleDay(31, null, "2026-02")).toBe(28);
  });
  it("회계기준월", () => {
    expect(fiscalMonths(2026, 1)[11]).toBe("2026-12");
    expect(fiscalMonths(2026, 3)).toContain("2027-02");
  });
});
