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
