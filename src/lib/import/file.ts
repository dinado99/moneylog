import { parseAssetTable, type AssetRow } from "./assets";
import { parseTable, type Cell, type TableParseResult } from "./table";

export function parseDelimited(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const delim = text.split("\n", 1)[0].includes("\t") ? "\t" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    // 국내 은행/카드사 CSV는 EUC-KR 인 경우가 많다
    return new TextDecoder("euc-kr").decode(buf);
  }
}

export class ImportError extends Error {}

export interface ImportResult {
  txns: TableParseResult;
  /** 뱅크샐러드 자산 현황(잔액) */
  assets: AssetRow[];
}

const EMPTY: TableParseResult = { rows: [], skipped: 0 };

function fromTables(tables: Cell[][][], emptyMessage: string): ImportResult {
  let txns: TableParseResult | null = null;
  let assets: AssetRow[] = [];
  for (const t of tables) {
    const parsed = parseTable(t);
    if (parsed?.rows.length && !txns) txns = parsed;
    if (!assets.length) assets = parseAssetTable(t);
  }
  if (!txns?.rows.length && !assets.length) throw new ImportError(emptyMessage);
  return { txns: txns ?? EMPTY, assets };
}

/** 엑셀/구글시트에서 복사한 표(탭 구분)나 CSV 텍스트 */
export function parsePastedText(text: string): ImportResult {
  return fromTables(
    [parseDelimited(text.trim())],
    "첫 줄에 제목 줄(날짜·금액 또는 항목·상품명·금액)이 있어야 해요.",
  );
}

export async function parseSpreadsheetFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    return fromTables([parseDelimited(decodeText(await file.arrayBuffer()))], "날짜와 금액 컬럼을 찾지 못했어요.");
  }
  if (name.endsWith(".xls")) {
    throw new ImportError("예전 엑셀 형식(.xls)은 지원하지 않아요. .xlsx 또는 .csv로 저장해 주세요.");
  }
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  // 뱅크샐러드 내보내기: '가계부 내역' 시트에 거래, '뱅샐현황' 시트에 자산 현황이 있다
  const ordered = [...sheets].sort((a, b) => Number(/가계부|내역/.test(b.sheet)) - Number(/가계부|내역/.test(a.sheet)));
  return fromTables(
    ordered.map((s) => s.data as unknown as Cell[][]),
    "거래 내역이나 자산 현황을 찾지 못했어요. 제목 줄이 있는지 확인해 주세요.",
  );
}
