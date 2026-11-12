"use client";

import useSWR from "swr";

/** 외화 보유액 (계좌 메모에 "외화 USD 120.5, JPY 3000"으로 저장) */
export interface FxHolding {
  currency: string;
  amount: number;
}

export const CURRENCIES: {
  code: string;
  name: string;
  flag: string;
  symbol: string;
}[] = [
  { code: "USD", name: "미국 달러", flag: "🇺🇸", symbol: "$" },
  { code: "JPY", name: "일본 엔", flag: "🇯🇵", symbol: "¥" },
  { code: "EUR", name: "유로", flag: "🇪🇺", symbol: "€" },
  { code: "CNY", name: "중국 위안", flag: "🇨🇳", symbol: "元" },
  { code: "TWD", name: "대만 달러", flag: "🇹🇼", symbol: "NT$" },
  { code: "HKD", name: "홍콩 달러", flag: "🇭🇰", symbol: "HK$" },
  { code: "GBP", name: "영국 파운드", flag: "🇬🇧", symbol: "£" },
  { code: "AUD", name: "호주 달러", flag: "🇦🇺", symbol: "A$" },
  { code: "CAD", name: "캐나다 달러", flag: "🇨🇦", symbol: "C$" },
  { code: "NZD", name: "뉴질랜드 달러", flag: "🇳🇿", symbol: "NZ$" },
  { code: "SGD", name: "싱가포르 달러", flag: "🇸🇬", symbol: "S$" },
  { code: "CHF", name: "스위스 프랑", flag: "🇨🇭", symbol: "CHF" },
  { code: "THB", name: "태국 바트", flag: "🇹🇭", symbol: "฿" },
  { code: "VND", name: "베트남 동", flag: "🇻🇳", symbol: "₫" },
  { code: "PHP", name: "필리핀 페소", flag: "🇵🇭", symbol: "₱" },
  { code: "MYR", name: "말레이시아 링깃", flag: "🇲🇾", symbol: "RM" },
  { code: "IDR", name: "인도네시아 루피아", flag: "🇮🇩", symbol: "Rp" },
  { code: "CZK", name: "체코 코루나", flag: "🇨🇿", symbol: "Kč" },
  { code: "HUF", name: "헝가리 포린트", flag: "🇭🇺", symbol: "Ft" },
  { code: "PLN", name: "폴란드 즐로티", flag: "🇵🇱", symbol: "zł" },
  { code: "TRY", name: "튀르키예 리라", flag: "🇹🇷", symbol: "₺" },
  { code: "AED", name: "아랍에미리트 디르함", flag: "🇦🇪", symbol: "AED" },
  { code: "MXN", name: "멕시코 페소", flag: "🇲🇽", symbol: "MX$" },
];

export const currencyInfo = (code: string) =>
  CURRENCIES.find((c) => c.code === code) ?? {
    code,
    name: code,
    flag: "💱",
    symbol: code,
  };

const FX = /\s*·?\s*외화 ([A-Z]{3} -?[\d.]+(?:,\s*[A-Z]{3} -?[\d.]+)*)/;

export function fxOf(memo: string): FxHolding[] {
  const m = memo.match(FX);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((p) => p.trim().split(/\s+/))
    .map(([currency, n]) => ({ currency, amount: Number(n) }))
    .filter((h) => h.currency && Number.isFinite(h.amount) && h.amount !== 0);
}

/** 메모의 외화 부분만 바꾼다 (다른 메모·잔액기준은 그대로) */
export function withFx(memo: string, list: FxHolding[]): string {
  const base = memo.replace(FX, "").trim().replace(/^·\s*/, "");
  const kept = list.filter(
    (h) => h.currency && Number.isFinite(h.amount) && h.amount !== 0,
  );
  if (!kept.length) return base;
  const part = `외화 ${kept.map((h) => `${h.currency} ${+h.amount.toFixed(4)}`).join(", ")}`;
  return base ? `${base} · ${part}` : part;
}

export function formatFx(h: FxHolding): string {
  const digits =
    h.currency === "JPY" ||
    h.currency === "VND" ||
    h.currency === "IDR" ||
    h.currency === "HUF"
      ? 0
      : 2;
  const s = Math.abs(h.amount).toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
  return `${h.amount < 0 ? "−" : ""}${currencyInfo(h.currency).symbol}${s}`;
}

/** 통화 1단위가 몇 원인지 */
export type Rates = Record<string, number>;

async function fetchRates(): Promise<{ rates: Rates; date: string }> {
  // 키 없는 무료 환율 (하루 한 번 바뀜). 하나가 안 되면 다른 곳에서
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/KRW");
    const d = (await r.json()) as {
      result: string;
      rates: Record<string, number>;
      time_last_update_utc: string;
    };
    if (d.result !== "success") throw new Error("fx");
    const rates: Rates = {};
    for (const [k, v] of Object.entries(d.rates)) if (v) rates[k] = 1 / v;
    return {
      rates,
      date: new Date(d.time_last_update_utc).toISOString().slice(0, 10),
    };
  } catch {
    const r = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/krw.json",
    );
    const d = (await r.json()) as { date: string; krw: Record<string, number> };
    const rates: Rates = {};
    for (const [k, v] of Object.entries(d.krw))
      if (v) rates[k.toUpperCase()] = 1 / v;
    return { rates, date: d.date };
  }
}

const CACHE = "moneylog:fx";

export function useRates() {
  return useSWR("fx", fetchRates, {
    fallbackData: (() => {
      try {
        const raw = localStorage.getItem(CACHE);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    })(),
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000,
    onSuccess: (d) => {
      try {
        localStorage.setItem(CACHE, JSON.stringify(d));
      } catch {}
    },
  });
}

/** 원화 환산 (환율을 모르면 null) */
export function toWon(list: FxHolding[], rates?: Rates): number | null {
  if (!rates) return null;
  let n = 0;
  for (const h of list) {
    const r = rates[h.currency];
    if (!r) return null;
    n += h.amount * r;
  }
  return Math.round(n);
}

/**
 * 기록으로 계산한 계좌별 외화 변동 + 충전한 원가(원화).
 * - 지출: 출금계좌에서 외화가 나감 (음수 외화 = 환불로 다시 들어옴)
 * - 수입: 입금계좌로 들어옴
 * - 이동: 외화 금액이 +면 입금계좌로 들어옴 (예: 우리은행 → 하나머니 USD 충전), −면 출금계좌에서 나감 (원화로 다시 바꿈)
 * 원가는 외화가 들어온 기록의 원화 금액 합 (평균 충전 환율 = 원가 ÷ 외화)
 */
export interface FxLedger {
  amount: number;
  /** 들어온 외화 합과 그때 낸 원화 합 (평균 충전 환율 계산용) */
  boughtFx: number;
  boughtWon: number;
}

export function fxLedger(
  records: { date: string; kind: string; amount: number; inAccount?: string; outAccount?: string; fx?: FxHolding }[],
  until?: string,
): Map<string, Map<string, FxLedger>> {
  const out = new Map<string, Map<string, FxLedger>>();
  const add = (acc: string | undefined, currency: string, amount: number, won: number) => {
    if (!acc) return;
    const byCur = out.get(acc) ?? new Map<string, FxLedger>();
    const l = byCur.get(currency) ?? { amount: 0, boughtFx: 0, boughtWon: 0 };
    l.amount += amount;
    if (amount > 0 && won > 0) {
      l.boughtFx += amount;
      l.boughtWon += won;
    }
    byCur.set(currency, l);
    out.set(acc, byCur);
  };
  for (const r of records) {
    if (!r.fx || (until && r.date > until)) continue;
    const { currency, amount } = r.fx;
    if (r.kind === "지출") add(r.outAccount, currency, -amount, 0);
    else if (r.kind === "수입") add(r.inAccount, currency, amount, 0);
    else if (amount > 0) add(r.inAccount, currency, amount, Math.abs(r.amount));
    else add(r.outAccount, currency, amount, 0);
  }
  return out;
}

/** 계좌의 지금 외화 = 메모의 시작 외화 + 기록 변동 */
export function holdingsOf(memo: string, ledger?: Map<string, FxLedger>): FxHolding[] {
  const map = new Map<string, number>();
  for (const h of fxOf(memo)) map.set(h.currency, h.amount);
  for (const [cur, l] of ledger ?? []) map.set(cur, (map.get(cur) ?? 0) + l.amount);
  return [...map]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 10000) / 10000 }))
    .filter((h) => h.amount !== 0);
}

/** 평균 충전 환율 (충전 기록이 없으면 null) */
export function costRate(ledger: Map<string, FxLedger> | undefined, currency: string): number | null {
  const l = ledger?.get(currency);
  return l && l.boughtFx > 0 ? l.boughtWon / l.boughtFx : null;
}
