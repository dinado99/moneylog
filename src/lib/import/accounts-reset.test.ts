import { describe, expect, it } from "vitest";
import { balances } from "../analytics";
import type { MoneyRecord, SheetSettings } from "../types";
import { asOfOf, compensations, planReset, withAsOf } from "./accounts-reset";

const settings = {
  startYear: 2025,
  fiscalMonth: 1,
  schedules: [],
  categories: [
    { kind: "자산", name: "💰현금·예금", subs: ["현금", "입출금통장", "CMA"].map((name) => ({ name, fixed: false })) },
    { kind: "자산", name: "📈 저축·투자", subs: ["예적금", "주식", "코인"].map((name) => ({ name, fixed: false })) },
    { kind: "자산", name: "🎸 기타자산", subs: ["예치금"].map((name) => ({ name, fixed: false })) },
    { kind: "부채", name: "💳 신용카드", subs: ["일시불", "할부"].map((name) => ({ name, fixed: false })) },
  ],
  accounts: [
    { sort: 1, kind: "자산", category: "💰현금·예금", subcategory: "입출금통장", name: "우리은행", start: 193435, memo: "주거래", hidden: false },
    { sort: 2, kind: "자산", category: "💰현금·예금", subcategory: "입출금통장", name: "카카오뱅크", start: 8000, memo: "", hidden: false },
    { sort: 3, kind: "부채", category: "💳 신용카드", subcategory: "일시불", name: "현대카드", start: 127500, memo: "", hidden: false },
  ],
} as SheetSettings;

const rec = (p: Partial<MoneyRecord>): MoneyRecord => ({ id: "x", key: "x", date: "2026-10-01", kind: "지출", content: "", amount: 0, ...p });
const records = [
  rec({ kind: "이동", amount: 100000, outAccount: "우리은행", inAccount: "청년주택청약" }),
  rec({ kind: "지출", amount: 25332, outAccount: "현대카드" }),
];

describe("뱅크샐러드 현황으로 계좌 목록 바꾸기", () => {
  const plan = planReset(
    settings,
    records,
    [
      { side: "자산", kind: "자유입출금 자산", name: "우리 드림하이 통장", balance: 2579815 },
      { side: "자산", kind: "저축성 자산", name: "청년 주택드림 청약통장", balance: 8825000 },
      { side: "자산", kind: "전자금융 자산", name: "네이버페이 머니", balance: 606 },
      { side: "부채", kind: "카드", name: "현대카드 M", balance: 25332 },
    ],
    (n) => ({ "우리 드림하이 통장": "우리은행", "현대카드 M": "현대카드" })[n],
    "2026-11-01",
  );

  it("이름·분류는 뱅크샐러드 기준, 예전 이름은 바꾸기 목록에", () => {
    expect(plan.accounts.map((a) => [a.kind, a.category, a.subcategory, a.name])).toEqual([
      ["자산", "💰현금·예금", "입출금통장", "우리 드림하이 통장"],
      ["자산", "📈 저축·투자", "예적금", "청년 주택드림 청약통장"],
      ["자산", "💰현금·예금", "입출금통장", "네이버페이 머니"],
      ["부채", "💳 신용카드", "일시불", "현대카드 M"],
    ]);
    expect(plan.renames).toEqual([
      { from: "우리은행", to: "우리 드림하이 통장" },
      { from: "현대카드", to: "현대카드 M" },
    ]);
    expect(plan.removed).toEqual(["카카오뱅크"]);
    expect(plan.accounts[0].memo).toBe("주거래 · 잔액기준 2026-11-01");
    expect(plan.accounts[1].memo).toBe("잔액기준 2026-11-01");
  });

  it("시작금액을 맞추면 시트 잔액이 뱅크샐러드 금액과 같아진다", () => {
    const renamed = records.map((r) => ({
      ...r,
      outAccount: plan.renames.find((x) => x.from === r.outAccount)?.to ?? r.outAccount,
      inAccount: plan.renames.find((x) => x.from === r.inAccount)?.to ?? r.inAccount,
    }));
    const accounts = plan.accounts.map((a, i) => ({ ...a, sort: i, subcategory: a.subcategory }));
    const b = Object.fromEntries(balances(accounts, renamed, "2026-11-01").map((a) => [a.name, a.balance]));
    expect(b).toEqual({ "우리 드림하이 통장": 2579815, "청년 주택드림 청약통장": 8825000, "네이버페이 머니": 606, "현대카드 M": 25332 });
  });
});

describe("잔액 기준일", () => {
  const plan = planReset(
    settings,
    records,
    [{ side: "자산", kind: "자유입출금 자산", name: "우리은행", balance: 1000000 }],
    (n) => n,
    "2026-11-01",
  );
  const accounts = plan.accounts.map((a, i) => ({ ...a, sort: i }));

  it("기준일 이전·당일 기록을 나중에 넣으면 시작금액을 되돌려 잔고가 그대로", () => {
    const later = [
      { date: "2026-11-01", kind: "지출" as const, content: "점심", amount: 9000, outAccount: "우리은행" },
      { date: "2026-11-02", kind: "지출" as const, content: "저녁", amount: 20000, outAccount: "우리은행" },
    ];
    const comp = compensations(accounts, later);
    expect(comp).toEqual([{ name: "우리은행", delta: 9000 }]);
    const fixed = accounts.map((a) => ({ ...a, start: a.start + (comp.find((c) => c.name === a.name)?.delta ?? 0) }));
    // 11/1 점심은 현황에 이미 있으니 잔고에 영향 없음, 11/2 저녁만 빠진다
    expect(balances(fixed, [...records, ...later], "2026-11-02")[0].balance).toBe(1000000 - 20000);
  });

  it("기준일 이전 기록을 지우면 시작금액을 반대로 되돌린다", () => {
    const old = { date: "2026-10-31", kind: "지출" as const, content: "택시", amount: 5000, outAccount: "우리은행" };
    expect(compensations(accounts, [], [old])).toEqual([{ name: "우리은행", delta: -5000 }]);
    // 금액만 고치면 차이만큼
    expect(compensations(accounts, [{ ...old, amount: 7000 }], [old])).toEqual([{ name: "우리은행", delta: 2000 }]);
  });

  it("메모 기준일 읽기·바꾸기", () => {
    expect(asOfOf("주거래 · 잔액기준 2026-11-01")).toBe("2026-11-01");
    expect(withAsOf("주거래 · 잔액기준 2026-10-01", "2026-11-01")).toBe("주거래 · 잔액기준 2026-11-01");
    expect(asOfOf("")).toBeNull();
  });
});
