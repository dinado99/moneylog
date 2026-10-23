import { mutate } from "swr";
import { allTxns } from "./db";
import { mapCategory, mapMethod } from "./import/map";
import { ensureAssets, type Settings } from "./settings-db";
import { supabase } from "./supabase";

/** 이미 저장된 내역의 분류·결제수단을 현재 분류/자산 설정에 맞춰 다시 정리한다. 바뀐 건수를 돌려준다. */
export async function remapAll(s: Settings): Promise<number> {
  const txns = await allTxns();
  const db = supabase();
  let changed = 0;

  const catGroups = new Map<string, (typeof txns)[number]>();
  const methods = new Map<string, number>();
  for (const t of txns) {
    catGroups.set(JSON.stringify([t.type, t.category, t.subcategory ?? null]), t);
    if (t.method) methods.set(t.method, (methods.get(t.method) ?? 0) + 1);
  }

  for (const t of catGroups.values()) {
    const next = mapCategory(s, t);
    if (next.category === t.category && (next.subcategory ?? null) === (t.subcategory ?? null)) continue;
    let q = db
      .from("transactions")
      .update({ category: next.category, subcategory: next.subcategory ?? null }, { count: "exact" })
      .eq("type", t.type)
      .eq("category", t.category);
    q = t.subcategory ? q.eq("subcategory", t.subcategory) : q.is("subcategory", null);
    const { error, count } = await q;
    if (error) throw new Error(error.message);
    changed += count ?? 0;
  }

  for (const [method, n] of methods) {
    const next = mapMethod(s, method);
    if (!next || next === method) continue;
    const { error } = await db.from("transactions").update({ method: next }).eq("method", method);
    if (error) throw new Error(error.message);
    changed += n;
  }

  await ensureAssets(s, [...methods.keys()].map((m) => mapMethod(s, m) ?? ""));
  await mutate((key) => Array.isArray(key) && key[0] === "txns");
  return changed;
}
