import { mutate } from "swr";
import { recordKey } from "./record-key";
import { check, supabase } from "./supabase";
import type { Account, Category, Config, MoneyRecord, RecordDraft, Schedule } from "./types";

export interface RecordRow {
  id: string;
  date: string;
  kind: MoneyRecord["kind"];
  category: string | null;
  subcategory: string | null;
  content: string;
  amount: number;
  in_account: string | null;
  out_account: string | null;
  source: MoneyRecord["source"];
  sheet_key: string | null;
  synced: boolean;
  deleted: boolean;
  created_at: string;
}

const RECORDS = "moneylog_records";
const CHUNK = 500;

export function fromRow(r: RecordRow): MoneyRecord {
  return {
    id: r.id,
    date: r.date,
    kind: r.kind,
    category: r.category ?? undefined,
    subcategory: r.subcategory ?? undefined,
    content: r.content,
    amount: Number(r.amount),
    inAccount: r.in_account ?? undefined,
    outAccount: r.out_account ?? undefined,
    source: r.source,
    sheetKey: r.sheet_key,
    synced: r.synced,
    createdAt: r.created_at,
  };
}

export function toRow(d: RecordDraft) {
  return {
    date: d.date,
    kind: d.kind,
    category: d.kind === "이동" ? null : d.category || null,
    subcategory: d.kind === "이동" ? null : d.subcategory || null,
    content: d.content.trim(),
    amount: Math.round(d.amount),
    in_account: d.inAccount || null,
    out_account: d.outAccount || null,
  };
}

export const refreshRecords = () => mutate((key) => Array.isArray(key) && key[0] === "records");
export const refreshSettings = () => mutate((key) => Array.isArray(key) && key[0] === "settings");

/** from <= date < to, 지운 것 제외 */
export async function rangeRecords(from: string, to: string): Promise<MoneyRecord[]> {
  const out: MoneyRecord[] = [];
  for (let start = 0; ; start += 1000) {
    const rows = check(
      await supabase()
        .from(RECORDS)
        .select("*")
        .eq("deleted", false)
        .gte("date", from)
        .lt("date", to)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(start, start + 999),
    ) as RecordRow[];
    out.push(...rows.map(fromRow));
    if (rows.length < 1000) return out;
  }
}

/** 동기화용: 전부 (지운 표시 포함) */
export async function allRecordRows(): Promise<RecordRow[]> {
  const out: RecordRow[] = [];
  for (let start = 0; ; start += 1000) {
    const rows = check(await supabase().from(RECORDS).select("*").order("id").range(start, start + 999)) as RecordRow[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export async function addRecords(drafts: RecordDraft[], source: MoneyRecord["source"] = "app") {
  for (let i = 0; i < drafts.length; i += CHUNK) {
    check(await supabase().from(RECORDS).insert(drafts.slice(i, i + CHUNK).map((d) => ({ ...toRow(d), source, synced: false }))));
  }
  await refreshRecords();
}

export async function updateRecord(id: string, d: RecordDraft) {
  check(
    await supabase()
      .from(RECORDS)
      .update({ ...toRow(d), synced: false, updated_at: new Date().toISOString() })
      .eq("id", id),
  );
  await refreshRecords();
}

/** 시트에 이미 있는 줄이면 지움 표시만 하고 다음 동기화 때 시트에서도 지운다. */
export async function deleteRecord(r: MoneyRecord) {
  if (r.sheetKey) check(await supabase().from(RECORDS).update({ deleted: true, synced: false }).eq("id", r.id));
  else check(await supabase().from(RECORDS).delete().eq("id", r.id));
  await refreshRecords();
}

/** 이미 있는 내역의 키 (가져오기 중복 확인용). 날짜 범위로 한 번에 조회 */
export async function existingKeys(drafts: RecordDraft[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!drafts.length) return counts;
  const dates = drafts.map((d) => d.date).sort();
  const next = new Date(dates.at(-1)! + "T00:00:00");
  next.setDate(next.getDate() + 1);
  const list = await rangeRecords(dates[0], next.toISOString().slice(0, 10));
  for (const r of list) {
    const k = dedupeKey(r);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/** 중복 판단: 날짜·구분·금액·내용 (분류·계좌가 달라도 같은 거래로 본다) */
export function dedupeKey(r: RecordDraft): string {
  return [r.date, r.kind, Math.round(r.amount), r.content.replace(/\s+/g, "").toLowerCase()].join("|");
}

// ── 설정 (시트에서 받아 온 사본 + 연결 정보) ─────────────

export interface Settings {
  config: Config;
  categories: Category[];
  accounts: Account[];
  schedules: Schedule[];
}

export async function loadSettings(): Promise<Settings> {
  const db = supabase();
  const [config, categories, accounts, schedules] = await Promise.all([
    db.from("moneylog_config").select("*").maybeSingle().then(check),
    db.from("moneylog_categories").select("*").order("sort").then(check),
    db.from("moneylog_accounts").select("*").order("sort").then(check),
    db.from("moneylog_schedules").select("*").order("sort").then(check),
  ]);
  const c = config as Record<string, unknown> | null;
  return {
    config: {
      sheetUrl: (c?.sheet_url as string) ?? null,
      sheetToken: (c?.sheet_token as string) ?? null,
      startYear: (c?.start_year as number) ?? null,
      fiscalMonth: (c?.fiscal_month as number) ?? 1,
      lastSync: (c?.last_sync as string) ?? null,
    },
    categories: (categories as Category[]).map((x) => ({ ...x, subs: x.subs ?? [] })),
    accounts: (accounts as Record<string, unknown>[]).map((a) => ({
      id: a.id as string,
      kind: a.kind as Account["kind"],
      category: a.category as string,
      subcategory: (a.subcategory as string) ?? null,
      name: a.name as string,
      startAmount: Number(a.start_amount),
      memo: (a.memo as string) ?? null,
      hidden: a.hidden as boolean,
      sort: a.sort as number,
    })),
    schedules: schedules as Schedule[],
  };
}

export async function saveConfig(patch: Partial<{ sheet_url: string | null; sheet_token: string | null }>) {
  const { data: user } = await supabase().auth.getUser();
  check(await supabase().from("moneylog_config").upsert({ user_id: user.user!.id, ...patch }));
  await refreshSettings();
}

export { recordKey };
