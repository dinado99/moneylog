import Dexie, { type EntityTable } from "dexie";
import type { Txn, TxnDraft, TxnSource } from "./types";

export const db = new Dexie("moneylog") as Dexie & {
  txns: EntityTable<Txn, "id">;
};

db.version(1).stores({
  txns: "id, date, type, category, hash",
});

function normalize(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, "").toLowerCase();
}

/** 같은 날, 같은 금액, 같은 가맹점(+시간)이면 같은 거래로 본다. */
export function txnHash(t: Pick<TxnDraft, "date" | "time" | "type" | "amount" | "merchant">): string {
  return [t.date, t.time ?? "", t.type, t.amount, normalize(t.merchant)].join("|");
}

function newId(): string {
  return crypto.randomUUID();
}

export function toTxn(draft: TxnDraft, source: TxnSource): Txn {
  return { ...draft, id: newId(), source, createdAt: Date.now(), hash: txnHash(draft) };
}

export async function saveTxn(draft: TxnDraft, existing?: Txn): Promise<void> {
  if (existing) {
    await db.txns.put({ ...existing, ...draft, hash: txnHash(draft) });
  } else {
    await db.txns.add(toTxn(draft, "manual"));
  }
}

export async function deleteTxn(id: string): Promise<void> {
  await db.txns.delete(id);
}

/** 이미 저장된 거래의 hash 집합 */
export async function existingHashes(hashes: string[]): Promise<Set<string>> {
  const found = await db.txns.where("hash").anyOf(hashes).toArray();
  return new Set(found.map((t) => t.hash));
}

export async function addMany(drafts: TxnDraft[], source: TxnSource): Promise<number> {
  const txns = drafts.map((d) => toTxn(d, source));
  await db.txns.bulkAdd(txns);
  return txns.length;
}

export async function monthTxns(month: string): Promise<Txn[]> {
  const list = await db.txns.where("date").between(`${month}-01`, `${month}-31`, true, true).toArray();
  return list.sort(compareTxnDesc);
}

export function compareTxnDesc(a: Txn, b: Txn): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const at = a.time ?? "";
  const bt = b.time ?? "";
  if (at !== bt) return at < bt ? 1 : -1;
  return b.createdAt - a.createdAt;
}
