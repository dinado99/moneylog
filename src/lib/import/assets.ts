import { parseAmount, type Cell } from "./table";

export interface AssetRow {
  /** 뱅크샐러드 항목 (자유입출금 자산, 저축성 자산 ...) */
  kind: string;
  name: string;
  balance: number;
}

function str(v: Cell): string {
  return v === null || v === undefined || v instanceof Date ? "" : String(v).trim();
}

/** "네이버페이 머니 - wlsd****" 처럼 가려진 계정 표시는 떼어 낸다. */
function cleanName(name: string): string {
  return name.replace(/\s+-\s+\S*\*+\S*$/, "").trim();
}

/**
 * 뱅크샐러드 '재무현황'의 자산 표(항목 | 상품명 | 금액)를 읽는다.
 * 항목 칸은 병합 셀이라 빈 칸이면 위 항목을 이어 쓴다. 표가 없으면 빈 배열.
 */
export function parseAssetTable(table: Cell[][]): AssetRow[] {
  for (let h = 0; h < table.length; h++) {
    const header = (table[h] ?? []).map((c) => str(c).replace(/\s/g, ""));
    const kindCol = header.indexOf("항목");
    if (kindCol < 0) continue;
    const nameCol = header.indexOf("상품명", kindCol);
    const amountCol = header.indexOf("금액", nameCol);
    if (nameCol < 0 || amountCol < 0) continue;

    const rows: AssetRow[] = [];
    let kind = "";
    for (const row of table.slice(h + 1)) {
      const k = str(row?.[kindCol]);
      const name = str(row?.[nameCol]);
      // 다음 표("4. 보험현황" 같은 제목)나 합계 줄에서 멈춘다
      if (/^\d+\.\s/.test(k) || (!k && !name && rows.length && row?.every((c) => !str(c)))) break;
      if (/총|합계/.test(k)) continue;
      if (k) kind = k;
      if (!name) continue;
      const balance = parseAmount(row?.[amountCol] ?? null);
      rows.push({ kind, name: cleanName(name), balance: Math.round(balance ?? 0) });
    }
    if (rows.length) return rows;
  }
  return [];
}
