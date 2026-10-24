export interface Slice {
  name: string;
  value: number;
  pct: number;
  color: string;
  /** "기타"로 접힌 분류들 */
  others?: string[];
}

const SLOTS = 7;

/** 금액 상위 7개만 색을 주고 나머지는 회색 "기타"로 접는다 (색을 돌려쓰지 않기 위해). */
export function slices(entries: [string, number][]): Slice[] {
  const total = entries.reduce((n, [, v]) => n + v, 0);
  if (!total) return [];
  const sorted = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const fold = sorted.length > SLOTS + 1;
  const top = fold ? sorted.slice(0, SLOTS) : sorted;
  const rest = fold ? sorted.slice(SLOTS) : [];
  const out: Slice[] = top.map(([name, value], i) => ({ name, value, pct: value / total, color: `var(--series-${(i % SLOTS) + 1})` }));
  if (rest.length) {
    const value = rest.reduce((n, [, v]) => n + v, 0);
    out.push({ name: "기타", value, pct: value / total, color: "var(--series-other)", others: rest.map(([n]) => n) });
  }
  return out;
}

/** 400000 → 40만, 12500 → 1.3만, 3200 → 3,200 */
export function shortWon(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${(n / 1e8).toFixed(1).replace(/\.0$/, "")}억`;
  if (abs >= 1e5) return `${Math.round(n / 1e4).toLocaleString("ko-KR")}만`;
  if (abs >= 1e4) return `${(n / 1e4).toFixed(1).replace(/\.0$/, "")}만`;
  return Math.round(n).toLocaleString("ko-KR");
}

export function pct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}
