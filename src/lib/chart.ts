export interface Slice {
  name: string;
  value: number;
  pct: number;
  color: string;
  /** 접힌 "기타"에 들어간 분류들 */
  others?: string[];
}

const SLOTS = 7;

/**
 * 금액 상위 7개 분류만 색을 주고 나머지는 "기타"(회색)로 접는다. 범주색을 돌려쓰지 않기 위해서다.
 * 색 순서는 금액 순위가 아니라 분류 설정 순서를 따른다(같은 분류가 순위가 바뀌어도 색이 덜 흔들리게).
 */
export function slices(entries: [string, number][], order: string[]): Slice[] {
  const total = entries.reduce((n, [, v]) => n + v, 0);
  if (!total) return [];
  const sorted = [...entries].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const fold = sorted.length > SLOTS + 1;
  const top = fold ? sorted.slice(0, SLOTS) : sorted;
  const rest = fold ? sorted.slice(SLOTS) : [];
  const rank = (name: string) => {
    const i = order.indexOf(name);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const colorOf = new Map(
    [...top]
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([name], i) => [name, i < SLOTS ? `var(--series-${i + 1})` : "var(--series-other)"]),
  );
  const out: Slice[] = top.map(([name, value]) => ({ name, value, pct: value / total, color: colorOf.get(name)! }));
  if (rest.length) {
    const value = rest.reduce((n, [, v]) => n + v, 0);
    out.push({ name: "기타", value, pct: value / total, color: "var(--series-other)", others: rest.map(([n]) => n) });
  }
  return out;
}
