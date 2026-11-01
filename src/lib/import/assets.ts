import { parseAmount, type Cell } from "./table";

export interface AssetRow {
  /** 자산 표인지 부채 표인지 */
  side: "자산" | "부채";
  /** 뱅크샐러드 항목 (자유입출금 자산, 저축성 자산, 카드 ...) */
  kind: string;
  name: string;
  /** 원 단위. 부채는 갚아야 할 금액(양수) */
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
 * 뱅크샐러드 '재무현황' 표(항목 | 상품명 | 금액)를 읽는다. 왼쪽은 자산, 오른쪽에 같은 모양이 또 있으면 부채.
 * 항목 칸은 병합 셀이라 빈 칸이면 위 항목을 이어 쓴다. 표가 없으면 빈 배열.
 */
export function parseAssetTable(table: Cell[][]): AssetRow[] {
  for (let h = 0; h < table.length; h++) {
    const header = (table[h] ?? []).map((c) => str(c).replace(/\s/g, ""));
    // 한 줄에 '항목 … 상품명 … 금액' 묶음이 여러 개일 수 있다 (자산 | 부채)
    const groups: { kindCol: number; nameCol: number; amountCol: number }[] = [];
    for (let i = 0; i < header.length; i++) {
      if (header[i] !== "항목") continue;
      const nameCol = header.indexOf("상품명", i);
      const amountCol = nameCol < 0 ? -1 : header.indexOf("금액", nameCol);
      const next = header.indexOf("항목", i + 1);
      if (nameCol > 0 && amountCol > 0 && (next < 0 || amountCol < next)) groups.push({ kindCol: i, nameCol, amountCol });
    }
    if (!groups.length) continue;

    // 표 위쪽 제목 줄에 '부채'가 있으면 그 표는 부채
    const above = (col: number) =>
      table
        .slice(Math.max(0, h - 3), h)
        .map((r) => [r?.[col], r?.[col + 1]].map(str).join(""))
        .join("");

    const rows: AssetRow[] = [];
    groups.forEach((g, gi) => {
      const side: AssetRow["side"] = /부채/.test(above(g.kindCol)) || gi > 0 ? "부채" : "자산";
      let kind = "";
      let seen = 0;
      for (const row of table.slice(h + 1)) {
        const k = str(row?.[g.kindCol]);
        const name = str(row?.[g.nameCol]);
        // 다음 표("4. 보험현황" 같은 제목)나 빈 줄 묶음에서 멈춘다
        if (/^\d+\.\s/.test(k)) break;
        if (!k && !name && seen && row?.every((c) => !str(c))) break;
        if (/총|합계/.test(k)) continue;
        if (k) kind = k;
        if (!name) continue;
        const balance = Math.round(parseAmount(row?.[g.amountCol] ?? null) ?? 0);
        rows.push({ side, kind, name: cleanName(name), balance: side === "부채" ? Math.abs(balance) : balance });
        seen++;
      }
    });
    if (rows.length) return rows;
  }
  return [];
}
