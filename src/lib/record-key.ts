import type { RecordDraft } from "./types";

/**
 * 시트 한 줄을 정규화한 값: [날짜, 구분, 대분류, 소분류, 내용, 금액, 입금계좌, 출금계좌]
 * Apps Script의 norm()과 반드시 같은 모양이어야 한다 (apps-script/Code.gs).
 */
export type SheetRow = [string, string, string, string, string, string, string, string];

const str = (v: string | undefined | null) => (v ?? "").trim();

// 외화 금액은 시트 '내용' 뒤에 "(USD 12.5)"로 붙여 둔다 (낼나 표에는 칸이 없고, 표 옆 열은 PC 정렬 때 어긋나서)
const FX = /\s*\(([A-Z]{3}) (-?[\d.]+)\)$/;

export function withFxContent(content: string, fx?: RecordDraft["fx"]): string {
  const base = str(content);
  if (!fx || !fx.currency || !fx.amount) return base;
  return `${base ? `${base} ` : ""}(${fx.currency} ${+fx.amount.toFixed(4)})`;
}

export function splitFxContent(content: string): { content: string; fx?: RecordDraft["fx"] } {
  const m = content.match(FX);
  if (!m) return { content };
  const amount = Number(m[2]);
  if (!Number.isFinite(amount) || !amount) return { content };
  return { content: content.slice(0, m.index).trim(), fx: { currency: m[1], amount } };
}

export function toSheetRow(r: RecordDraft): SheetRow {
  return [
    r.date,
    r.kind,
    r.kind === "이동" ? "" : str(r.category),
    r.kind === "이동" ? "" : str(r.subcategory),
    withFxContent(r.content, r.fx),
    String(Math.round(r.amount)),
    str(r.inAccount),
    str(r.outAccount),
  ];
}

export function keyOfRow(row: SheetRow): string {
  return JSON.stringify(row);
}

export function recordKey(r: RecordDraft): string {
  return keyOfRow(toSheetRow(r));
}

export function fromSheetRow(row: SheetRow): RecordDraft {
  const [date, kind, category, subcategory, rawContent, amount, inAccount, outAccount] = row;
  const { content, fx } = splitFxContent(rawContent);
  return {
    date,
    kind: kind as RecordDraft["kind"],
    category: category || undefined,
    subcategory: subcategory || undefined,
    content,
    amount: Number(amount),
    inAccount: inAccount || undefined,
    outAccount: outAccount || undefined,
    ...(fx ? { fx } : {}),
  };
}
