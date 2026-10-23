import { ALL_CATEGORY_NAMES, defaultCategory, guessExpenseCategory } from "../categories";
import type { TxnDraft, TxnType } from "../types";

export type Cell = string | number | boolean | Date | null | undefined;

type Field =
  | "date"
  | "time"
  | "type"
  | "category"
  | "subcategory"
  | "merchant"
  | "amount"
  | "withdraw"
  | "deposit"
  | "method"
  | "memo";

// 앞에 있을수록 우선. 뱅크샐러드 내보내기 + 일반 카드/은행 내역 헤더를 커버한다.
const HEADER_KEYWORDS: Record<Field, string[]> = {
  date: ["날짜", "거래일자", "거래일시", "거래일", "이용일자", "이용일시", "이용일", "승인일자", "승인일시", "일자", "date"],
  time: ["시간", "거래시간", "이용시간", "승인시간", "time"],
  type: ["타입", "구분", "유형", "입출금구분", "type"],
  category: ["대분류", "카테고리", "분류", "category"],
  subcategory: ["소분류"],
  merchant: ["내용", "가맹점명", "가맹점", "이용가맹점", "사용처", "거래내용", "적요", "상호", "거래처", "merchant", "description"],
  amount: ["금액", "이용금액", "결제금액", "승인금액", "거래금액", "amount"],
  withdraw: ["출금액", "출금금액", "출금", "찾으신금액", "지출금액"],
  deposit: ["입금액", "입금금액", "입금", "맡기신금액", "수입금액"],
  method: ["결제수단", "카드명", "카드", "계좌", "수단"],
  memo: ["메모", "비고", "memo"],
};

function normHeader(v: Cell): string {
  return String(v ?? "").replace(/[\s()[\]]/g, "").toLowerCase();
}

function mapHeader(row: Cell[]): Partial<Record<Field, number>> | null {
  const cols = row.map(normHeader);
  const map: Partial<Record<Field, number>> = {};
  const used = new Set<number>();
  const fields = Object.keys(HEADER_KEYWORDS) as Field[];
  // 1차: 정확히 일치, 2차: 포함
  for (const exact of [true, false]) {
    for (const field of fields) {
      if (map[field] !== undefined) continue;
      for (const kw of HEADER_KEYWORDS[field]) {
        const idx = cols.findIndex((c, i) => !used.has(i) && c !== "" && (exact ? c === kw : c.includes(kw)));
        if (idx >= 0) {
          map[field] = idx;
          used.add(idx);
          break;
        }
      }
    }
  }
  const hasAmount = map.amount !== undefined || map.withdraw !== undefined || map.deposit !== undefined;
  if (map.date === undefined || !hasAmount) return null;
  return map;
}

const pad = (n: number) => String(n).padStart(2, "0");

function excelSerialToDate(serial: number): Date {
  // 1899-12-30 기준 (UTC)
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}

export function parseDate(v: Cell, fallbackYear: number): string | null {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) return parseDate(excelSerialToDate(v), fallbackYear);
    if (v > 19000101 && v < 21001231) return parseDate(String(v), fallbackYear);
    return null;
  }
  const s = String(v ?? "").trim();
  let m = s.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return `20${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (m) return `${fallbackYear}-${pad(+m[1])}-${pad(+m[2])}`;
  return null;
}

export function parseTime(v: Cell): string | undefined {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return undefined;
    return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
  }
  if (typeof v === "number" && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60);
    return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
  }
  const m = String(v ?? "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${pad(+m[1])}:${m[2]}` : undefined;
}

export function parseAmount(v: Cell): number | null {
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v ?? "").replace(/[,\s원₩]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s.replace(/^\((.*)\)$/, "-$1"));
  return isFinite(n) ? n : null;
}

function str(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return "";
  return String(v).trim();
}

function parseType(v: Cell): TxnType | null {
  const s = str(v);
  if (/이체|transfer/i.test(s)) return "transfer";
  if (/수입|입금|income/i.test(s)) return "income";
  if (/지출|출금|결제|승인|expense/i.test(s)) return "expense";
  return null;
}

function normalizeCategory(raw: string, type: TxnType, merchant: string): string {
  if (!raw || raw === "미분류") {
    return (type === "expense" && guessExpenseCategory(merchant)) || defaultCategory(type);
  }
  if (ALL_CATEGORY_NAMES.includes(raw)) return raw;
  const compact = raw.replace(/\s/g, "");
  const hit = ALL_CATEGORY_NAMES.find((c) => c.replace(/\s/g, "") === compact);
  return hit ?? raw;
}

export interface TableParseResult {
  rows: TxnDraft[];
  skipped: number;
}

/** 표 형태(헤더 + 행) 데이터를 거래 목록으로 변환. 헤더를 못 찾으면 null. */
export function parseTable(table: Cell[][], fallbackYear = new Date().getFullYear()): TableParseResult | null {
  let headerIdx = -1;
  let map: Partial<Record<Field, number>> | null = null;
  for (let i = 0; i < Math.min(table.length, 30); i++) {
    map = mapHeader(table[i] ?? []);
    if (map) {
      headerIdx = i;
      break;
    }
  }
  if (!map) return null;
  const f = map;
  const body = table.slice(headerIdx + 1);
  const get = (row: Cell[], field: Field): Cell => (f[field] === undefined ? undefined : row[f[field]!]);

  // 단일 금액 컬럼에 음수가 섞여 있으면 부호로 지출/수입을 구분, 아니면 전부 지출로 본다.
  const signed =
    f.amount !== undefined && body.some((r) => (parseAmount(get(r, "amount")) ?? 0) < 0);

  const rows: TxnDraft[] = [];
  let skipped = 0;
  for (const row of body) {
    if (!row || row.every((c) => str(c) === "" && !(c instanceof Date) && typeof c !== "number")) continue;
    const date = parseDate(get(row, "date"), fallbackYear);
    if (!date) {
      skipped++;
      continue;
    }

    let amount: number | null = null;
    let type: TxnType | null = parseType(get(row, "type"));
    if (f.withdraw !== undefined || f.deposit !== undefined) {
      const w = parseAmount(get(row, "withdraw")) ?? 0;
      const d = parseAmount(get(row, "deposit")) ?? 0;
      if (w) {
        amount = w;
        type ??= "expense";
      } else if (d) {
        amount = d;
        type ??= "income";
      }
    }
    if (amount === null && f.amount !== undefined) {
      const a = parseAmount(get(row, "amount"));
      if (a !== null && a !== 0) {
        amount = a;
        type ??= signed ? (a < 0 ? "expense" : "income") : "expense";
      }
    }
    if (amount === null || !type) {
      skipped++;
      continue;
    }

    amount = Math.abs(Math.round(amount));
    const timeFromDate = parseTime(get(row, "date"));
    const time = parseTime(get(row, "time")) ?? (timeFromDate !== "00:00" ? timeFromDate : undefined);
    const merchant = str(get(row, "merchant")) || str(get(row, "memo")) || "(내용 없음)";
    const subcategory = str(get(row, "subcategory")) || undefined;
    const memo = str(get(row, "memo")) || undefined;

    rows.push({
      date,
      time,
      type,
      amount,
      merchant,
      category: normalizeCategory(str(get(row, "category")), type, merchant),
      subcategory: subcategory && subcategory !== "미분류" ? subcategory : undefined,
      method: str(get(row, "method")) || undefined,
      memo: memo !== merchant ? memo : undefined,
    });
  }
  return { rows, skipped };
}
