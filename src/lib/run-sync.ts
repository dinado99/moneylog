import { allRecordRows, refreshRecords, refreshSettings, toRow, type RecordRow, type Settings } from "./db";
import { pullSheet, pushSheet, SheetError } from "./sheet";
import { check, supabase } from "./supabase";
import { diffWithSheet, pendingOps } from "./sync";

const CHUNK = 500;

async function deleteIds(ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    check(await supabase().from("moneylog_records").delete().in("id", ids.slice(i, i + 200)));
  }
}

/** 앱에서 바뀐 것만 시트로 보낸다. 보낸 건수를 돌려준다. */
async function push(url: string, token: string, rows: RecordRow[]): Promise<number> {
  const { ops, dropIds } = pendingOps(rows);
  await deleteIds(dropIds);
  if (!ops.length) return 0;
  const { results } = await pushSheet(url, token, ops.map((o) => o.op));
  const done = ops.filter((_, i) => results[i]?.ok);
  await deleteIds(done.filter((o) => o.deleted).map((o) => o.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const upserts = done
    .filter((o) => !o.deleted)
    .map((o) => {
      const { created_at, ...rest } = byId.get(o.id)!;
      return { ...rest, created_at, synced: true, sheet_key: o.key };
    });
  for (let i = 0; i < upserts.length; i += CHUNK) check(await supabase().from("moneylog_records").upsert(upserts.slice(i, i + CHUNK)));
  const failed = results.find((r) => !r.ok);
  if (failed) throw new SheetError(failed.error ?? "일부 내역을 시트에 넣지 못했어요");
  return done.length;
}

export interface SyncResult {
  pushed: number;
  added: number;
  removed: number;
}

function needConfig(s: Settings) {
  const { sheetUrl, sheetToken } = s.config;
  if (!sheetUrl || !sheetToken) throw new SheetError("설정에서 구글 시트를 먼저 연결해 주세요.");
  return { url: sheetUrl, token: sheetToken };
}

/** 앱 → 시트만 (저장할 때마다) */
export async function pushPending(s: Settings): Promise<number> {
  const { url, token } = needConfig(s);
  const n = await push(url, token, await allRecordRows());
  if (n) await refreshRecords();
  return n;
}

/** 앱 → 시트, 그다음 시트 → 앱 (분류·계좌·일정 포함) */
export async function fullSync(s: Settings): Promise<SyncResult> {
  const { url, token } = needConfig(s);
  const db = supabase();
  const pushed = await push(url, token, await allRecordRows());

  const { records, settings } = await pullSheet(url, token);
  const { removeIds, add } = diffWithSheet(await allRecordRows(), records);
  await deleteIds(removeIds);
  const inserts = add.map(({ draft, key }) => ({ ...toRow(draft), source: "sheet", synced: true, sheet_key: key }));
  for (let i = 0; i < inserts.length; i += CHUNK) check(await db.from("moneylog_records").insert(inserts.slice(i, i + CHUNK)));

  // 설정은 시트가 원본: 통째로 바꾼다
  check(await db.from("moneylog_categories").delete().not("id", "is", null));
  check(await db.from("moneylog_accounts").delete().not("id", "is", null));
  check(await db.from("moneylog_schedules").delete().not("id", "is", null));
  if (settings.categories.length) {
    check(
      await db.from("moneylog_categories").insert(
        settings.categories.map((c, i) => ({ kind: c.kind, name: c.name, subs: c.subs, fixed: c.subs.some((x) => x.fixed), sort: i })),
      ),
    );
  }
  if (settings.accounts.length) {
    check(
      await db.from("moneylog_accounts").insert(
        settings.accounts.map((a, i) => ({
          kind: a.kind,
          category: a.category,
          subcategory: a.subcategory || null,
          name: a.name,
          start_amount: Math.round(a.start),
          memo: a.memo || null,
          hidden: a.hidden,
          sort: a.sort || i,
        })),
      ),
    );
  }
  if (settings.schedules.length) {
    check(await db.from("moneylog_schedules").insert(settings.schedules.map((x, i) => ({ ...x, sort: i }))));
  }
  const { data: user } = await db.auth.getUser();
  check(
    await db.from("moneylog_config").upsert({
      user_id: user.user!.id,
      start_year: settings.startYear,
      fiscal_month: settings.fiscalMonth,
      last_sync: new Date().toISOString(),
    }),
  );
  await Promise.all([refreshRecords(), refreshSettings()]);
  return { pushed, added: inserts.length, removed: removeIds.length };
}
