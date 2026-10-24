import type { SheetRow } from "./record-key";
import type { SheetSettings } from "./types";

export type SheetOp = { op: "add"; row: SheetRow } | { op: "update"; match: string; row: SheetRow } | { op: "delete"; match: string };

export interface Connection {
  url: string;
  token: string;
}

export class SheetError extends Error {}

async function call<T>(c: Connection, body: object): Promise<T> {
  let res: Response;
  try {
    // text/plain이면 브라우저가 사전 확인(CORS preflight)을 하지 않아 Apps Script로 바로 보낼 수 있다
    res = await fetch(c.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: c.token, ...body }),
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

export function pullSheet(c: Connection) {
  return call<{ records: SheetRow[]; settings: SheetSettings }>(c, { action: "pull" });
}

export async function pushSheet(c: Connection, ops: SheetOp[]) {
  const { results } = await call<{ results: { ok: boolean; error?: string }[] }>(c, { action: "push", ops });
  const failed = results.find((r) => !r.ok);
  if (failed) throw new SheetError(failed.error ?? "시트에 반영하지 못했어요");
}
