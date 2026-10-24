import type { RecordDraft } from "./types";

/**
 * 시트 한 줄을 정규화한 값: [날짜, 구분, 대분류, 소분류, 내용, 금액, 입금계좌, 출금계좌]
 * Apps Script의 norm()과 반드시 같은 모양이어야 한다 (apps-script/Code.gs).
 */
export type SheetRow = [string, string, string, string, string, string, string, string];

const str = (v: string | undefined | null) => (v ?? "").trim();

export function toSheetRow(r: RecordDraft): SheetRow {
  return [
    r.date,
    r.kind,
    r.kind === "이동" ? "" : str(r.category),
    r.kind === "이동" ? "" : str(r.subcategory),
    str(r.content),
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
  const [date, kind, category, subcategory, content, amount, inAccount, outAccount] = row;
  return {
    date,
    kind: kind as RecordDraft["kind"],
    category: category || undefined,
    subcategory: subcategory || undefined,
    content,
    amount: Number(amount),
    inAccount: inAccount || undefined,
    outAccount: outAccount || undefined,
  };
}
