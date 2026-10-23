import { mutate } from "swr";
import { supabase } from "./supabase";
import type { Txn, TxnDraft, TxnSource } from "./types";

interface TxnRow {
  id: string;
  date: string;
  time: string | null;
  type: Txn["type"];
  amount: number;
  category: string;
  subcategory: string | null;
  merchant: string;
  method: string | null;
  memo: string | null;
  source: TxnSource;
  hash: string;
  created_at: string;
}

const TABLE = "transactions";
const CHUNK = 500;

function fromRow(r: TxnRow): Txn {
  return {
    id: r.id,
    date: r.date,
    time: r.time ?? undefined,
    type: r.type,
    amount: Number(r.amount),
    category: r.category,
    subcategory: r.subcategory ?? undefined,
    merchant: r.merchant,
    method: r.method ?? undefined,
    memo: r.memo ?? undefined,
    source: r.source,
    hash: r.hash,
    createdAt: Date.parse(r.created_at),
  };
}

function toRow(d: TxnDraft, source: TxnSource) {
  return {
    date: d.date,
    time: d.time ?? null,
    type: d.type,
    amount: d.amount,
    category: d.category,
    subcategory: d.subcategory ?? null,
    merchant: d.merchant,
    method: d.method ?? null,
    memo: d.memo ?? null,
    source,
    hash: txnHash(d),
  };
}

function normalize(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, "").toLowerCase();
}

/** 같은 날, 같은 금액, 같은 가맹점(+시간)이면 같은 거래로 본다. */
export function txnHash(t: Pick<TxnDraft, "date" | "time" | "type" | "amount" | "merchant">): string {
  return [t.date, t.time ?? "", t.type, t.amount, normalize(t.merchant)].join("|");
}

/** 거래 목록을 쓰는 화면(SWR 키 "txns"로 시작)을 다시 불러온다. */
function refresh() {
  return mutate((key) => Array.isArray(key) && key[0] === "txns");
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

export async function saveTxn(draft: TxnDraft, existing?: Txn): Promise<void> {
  const row = toRow(draft, existing?.source ?? "manual");
  if (existing) check(await supabase().from(TABLE).update(row).eq("id", existing.id));
  else check(await supabase().from(TABLE).insert(row));
  await refresh();
}

export async function deleteTxn(id: string): Promise<void> {
  check(await supabase().from(TABLE).delete().eq("id", id));
  await refresh();
}

/** 이미 저장된 거래의 hash 집합 (가져올 내역의 날짜 범위 안에서 조회) */
export async function existingHashes(drafts: TxnDraft[]): Promise<Set<string>> {
  if (!drafts.length) return new Set();
  const dates = drafts.map((d) => d.date).sort();
  const rows = check(
    await supabase()
      .from(TABLE)
      .select("hash")
      .gte("date", dates[0])
      .lte("date", dates[dates.length - 1]),
  ) as { hash: string }[];
  return new Set(rows.map((r) => r.hash));
}

export async function addMany(drafts: TxnDraft[], source: TxnSource): Promise<number> {
  for (let i = 0; i < drafts.length; i += CHUNK) {
    check(await supabase().from(TABLE).insert(drafts.slice(i, i + CHUNK).map((d) => toRow(d, source))));
  }
  await refresh();
  return drafts.length;
}

export async function monthTxns(month: string): Promise<Txn[]> {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(y, m, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  const rows = check(
    await supabase()
      .from(TABLE)
      .select("*")
      .gte("date", `${month}-01`)
      .lt("date", end)
      .order("date", { ascending: false })
      .order("time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ) as TxnRow[];
  return rows.map(fromRow);
}

export async function countTxns(): Promise<number> {
  const { count, error } = await supabase().from(TABLE).select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function allTxns(): Promise<Txn[]> {
  const out: Txn[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(
      await supabase().from(TABLE).select("*").order("date").order("created_at").range(from, from + 999),
    ) as TxnRow[];
    out.push(...rows.map(fromRow));
    if (rows.length < 1000) return out;
  }
}

/** 백업 복원: 이미 있는 내역(hash 기준)은 건너뛴다. */
export async function restoreTxns(txns: Txn[]): Promise<number> {
  const existing = await existingHashes(txns);
  const fresh = txns.filter((t) => !existing.has(txnHash(t)));
  for (let i = 0; i < fresh.length; i += CHUNK) {
    check(await supabase().from(TABLE).insert(fresh.slice(i, i + CHUNK).map((t) => toRow(t, t.source))));
  }
  await refresh();
  return fresh.length;
}

export async function deleteAllTxns(): Promise<void> {
  // RLS 때문에 본인 내역만 지워진다
  check(await supabase().from(TABLE).delete().not("id", "is", null));
  await refresh();
}
