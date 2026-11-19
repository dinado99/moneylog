import { describe, expect, it } from "vitest";
import { accountGroups, filterNames, matchesFilter } from "./record-filter";
import type { Account } from "./types";

const acc = (kind: "자산" | "부채", category: string, name: string, sort: number): Account => ({ kind, category, subcategory: "", name, start: 0, memo: "", hidden: false, sort });
const accounts = [
  acc("부채", "💳 신용카드", "현대카드", 5),
  acc("자산", "💰 현금·예금", "우리은행", 1),
  acc("자산", "💰 현금·예금", "하나머니", 2),
  acc("부채", "💳 신용카드", "현대카드", 6), // 할부 (같은 이름)
];

describe("계좌 필터", () => {
  it("대분류는 자산 먼저, 같은 이름 계좌는 하나로", () => {
    expect(accountGroups(accounts)).toEqual([
      { category: "💰 현금·예금", kind: "자산", names: ["우리은행", "하나머니"] },
      { category: "💳 신용카드", kind: "부채", names: ["현대카드"] },
    ]);
  });

  it("입금·출금 어느 쪽이든 그 계좌가 들어간 내역", () => {
    const names = filterNames({ category: "💰 현금·예금" }, accounts);
    expect(matchesFilter({ date: "", kind: "이동", content: "", amount: 1, outAccount: "우리은행", inAccount: "카카오페이" }, names)).toBe(true);
    expect(matchesFilter({ date: "", kind: "지출", content: "", amount: 1, outAccount: "현대카드" }, names)).toBe(false);
    expect(matchesFilter({ date: "", kind: "지출", content: "", amount: 1, outAccount: "현대카드" }, filterNames({ account: "현대카드" }, accounts))).toBe(true);
    expect(filterNames({}, accounts)).toBeNull();
  });
});
