import type { SheetRow } from "./record-key";

export interface SheetSettings {
  startYear: number | null;
  fiscalMonth: number;
  categories: { kind: "자산" | "부채" | "수입" | "지출"; name: string; subs: { name: string; fixed: boolean }[] }[];
  accounts: {
    sort: number;
    kind: "자산" | "부채";
    category: string;
    subcategory: string;
    name: string;
    start: number;
    memo: string;
    hidden: boolean;
  }[];
  schedules: { name: string; day: number; weekend: "당기기" | "밀기" | null }[];
}

export type SheetOp = { op: "add"; row: SheetRow } | { op: "update"; match: string; row: SheetRow } | { op: "delete"; match: string };

export class SheetError extends Error {}

async function call<T>(url: string, token: string, body: object): Promise<T> {
  let res: Response;
  try {
    // text/plain이면 브라우저가 사전 확인(CORS preflight)을 하지 않아 Apps Script로 바로 보낼 수 있다
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token, ...body }),
      redirect: "follow",
    });
  } catch {
    throw new SheetError("구글 시트에 연결하지 못했어요. 인터넷과 웹 앱 URL을 확인해 주세요.");
  }
  const text = await res.text();
  let data: { error?: string } & T;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SheetError("구글 시트 응답을 읽지 못했어요. 배포할 때 액세스를 '모든 사용자'로 했는지 확인해 주세요.");
  }
  if (data.error) throw new SheetError(data.error);
  return data;
}

export function pullSheet(url: string, token: string) {
  return call<{ records: SheetRow[]; settings: SheetSettings }>(url, token, { action: "pull" });
}

export function pushSheet(url: string, token: string, ops: SheetOp[]) {
  return call<{ results: { ok: boolean; error?: string }[] }>(url, token, { action: "push", ops });
}
