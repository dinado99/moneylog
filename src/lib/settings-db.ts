import useSWR, { mutate } from "swr";
import { DEFAULT_ASSET_GROUPS, DEFAULT_CATEGORIES } from "./defaults";
import { supabase } from "./supabase";

export interface Category {
  id: string;
  type: "expense" | "income";
  parent_id: string | null;
  name: string;
  emoji: string | null;
  sort: number;
}

export interface AssetGroup {
  id: string;
  name: string;
  emoji: string | null;
  sort: number;
}

export interface Asset {
  id: string;
  group_id: string;
  name: string;
  aliases: string[];
  sort: number;
  balance: number | null;
  balance_updated_at: string | null;
}

export interface MainCategory extends Category {
  subs: Category[];
}

export interface Settings {
  categories: Category[];
  groups: AssetGroup[];
  assets: Asset[];
}

const KEY = ["settings"];

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

const bySort = <T extends { sort: number; name: string }>(a: T, b: T) => a.sort - b.sort || a.name.localeCompare(b.name);

async function fetchSettings(): Promise<Settings> {
  const db = supabase();
  const [categories, groups, assets] = await Promise.all([
    db.from("categories").select("id, type, parent_id, name, emoji, sort").then(check),
    db.from("asset_groups").select("id, name, emoji, sort").then(check),
    db.from("assets").select("id, group_id, name, aliases, sort, balance, balance_updated_at").then(check),
  ]);
  return {
    categories: (categories as Category[]).sort(bySort),
    groups: (groups as AssetGroup[]).sort(bySort),
    assets: (assets as Asset[]).map((a) => ({ ...a, balance: a.balance === null ? null : Number(a.balance) })).sort(bySort),
  };
}

async function seedCategories() {
  const db = supabase();
  const mains = check(
    await db
      .from("categories")
      .insert(DEFAULT_CATEGORIES.map((c, i) => ({ type: c.type, name: c.name, emoji: c.emoji, sort: i })))
      .select("id, type, name"),
  ) as Pick<Category, "id" | "type" | "name">[];
  const subs = DEFAULT_CATEGORIES.flatMap((c) => {
    const parent = mains.find((m) => m.type === c.type && m.name === c.name)!;
    return c.subs.map((name, i) => ({ type: c.type, parent_id: parent.id, name, sort: i }));
  });
  check(await db.from("categories").insert(subs));
}

async function seedGroups() {
  check(await supabase().from("asset_groups").insert(DEFAULT_ASSET_GROUPS.map((g, i) => ({ ...g, sort: i }))));
}

/** 분류·자산 설정. 분류나 자산 그룹이 하나도 없으면 기본값을 넣어 준다. */
export async function loadSettings(): Promise<Settings> {
  const s = await fetchSettings();
  if (s.categories.length && s.groups.length) return s;
  // 다른 탭에서 동시에 넣은 경우(unique 충돌) 등은 다시 읽기만 하면 된다
  if (!s.categories.length) await seedCategories().catch(() => {});
  if (!s.groups.length) await seedGroups().catch(() => {});
  return fetchSettings();
}

export function useSettings() {
  return useSWR(KEY, loadSettings);
}

export function mainCategories(s: Settings, type: "expense" | "income"): MainCategory[] {
  return s.categories
    .filter((c) => c.type === type && !c.parent_id)
    .map((m) => ({ ...m, subs: s.categories.filter((c) => c.parent_id === m.id) }));
}

const refreshSettings = () => mutate(KEY);
const refreshTxns = () => mutate((key) => Array.isArray(key) && key[0] === "txns");

function nextSort(list: { sort: number }[]) {
  return list.reduce((m, x) => Math.max(m, x.sort + 1), 0);
}

// ── 분류 ──────────────────────────────────────────

export async function addCategory(
  s: Settings,
  input: { type: "expense" | "income"; name: string; emoji?: string | null; parentId?: string | null },
): Promise<Category> {
  const siblings = s.categories.filter((c) => c.type === input.type && c.parent_id === (input.parentId ?? null));
  const row = check(
    await supabase()
      .from("categories")
      .insert({
        type: input.type,
        name: input.name.trim(),
        emoji: input.emoji || null,
        parent_id: input.parentId ?? null,
        sort: nextSort(siblings),
      })
      .select("id, type, parent_id, name, emoji, sort")
      .single(),
  ) as Category;
  await refreshSettings();
  return row;
}

/** 이름이 바뀌면 이미 저장된 내역의 분류 이름도 같이 바꾼다. */
export async function updateCategory(s: Settings, cat: Category, patch: { name: string; emoji?: string | null }) {
  const name = patch.name.trim();
  const db = supabase();
  check(await db.from("categories").update({ name, emoji: patch.emoji ?? cat.emoji }).eq("id", cat.id));
  if (name !== cat.name) {
    if (!cat.parent_id) {
      check(await db.from("transactions").update({ category: name }).eq("type", cat.type).eq("category", cat.name));
    } else {
      const parent = s.categories.find((c) => c.id === cat.parent_id)!;
      check(
        await db
          .from("transactions")
          .update({ subcategory: name })
          .eq("type", cat.type)
          .eq("category", parent.name)
          .eq("subcategory", cat.name),
      );
    }
    await refreshTxns();
  }
  await refreshSettings();
}

export async function deleteCategory(id: string) {
  check(await supabase().from("categories").delete().eq("id", id));
  await refreshSettings();
}

/** 목록에서 한 칸 위/아래로 옮기고 정렬 값을 0,1,2... 로 다시 매긴다. */
export async function moveItem<T extends { id: string; sort: number }>(
  table: "categories" | "asset_groups" | "assets",
  list: T[],
  item: T,
  dir: -1 | 1,
) {
  const i = list.findIndex((x) => x.id === item.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const order = [...list];
  [order[i], order[j]] = [order[j], order[i]];
  const db = supabase();
  await Promise.all(
    order.map((x, idx) => (x.sort === idx ? null : db.from(table).update({ sort: idx }).eq("id", x.id).then(check))),
  );
  await refreshSettings();
}

// ── 자산 ──────────────────────────────────────────

export async function addGroup(s: Settings, name: string, emoji?: string | null) {
  check(
    await supabase()
      .from("asset_groups")
      .insert({ name: name.trim(), emoji: emoji || null, sort: nextSort(s.groups) }),
  );
  await refreshSettings();
}

export async function updateGroup(group: AssetGroup, patch: { name: string; emoji?: string | null }) {
  check(
    await supabase()
      .from("asset_groups")
      .update({ name: patch.name.trim(), emoji: patch.emoji || null })
      .eq("id", group.id),
  );
  await refreshSettings();
}

export async function deleteGroup(id: string) {
  check(await supabase().from("asset_groups").delete().eq("id", id));
  await refreshSettings();
}

export async function addAsset(s: Settings, groupId: string, name: string, balance: number | null = null) {
  check(
    await supabase()
      .from("assets")
      .insert({
        group_id: groupId,
        name: name.trim(),
        sort: nextSort(s.assets.filter((a) => a.group_id === groupId)),
        ...balanceFields(balance),
      }),
  );
  await refreshSettings();
}

/**
 * 이름을 바꾸면 예전 이름은 별칭으로 남겨서 다음 가져오기에서도 같은 자산으로 인식한다.
 * 이미 있는 다른 자산 이름으로 바꾸면 두 자산을 하나로 합친다.
 */
function balanceFields(balance: number | null) {
  return balance === null ? {} : { balance, balance_updated_at: new Date().toISOString() };
}

export async function updateAsset(
  s: Settings,
  asset: Asset,
  patch: { name: string; groupId: string; balance?: number | null },
) {
  const db = supabase();
  const name = patch.name.trim();
  const target = s.assets.find((a) => a.id !== asset.id && a.name === name);
  const oldNames = [asset.name, ...asset.aliases];

  if (target) {
    const aliases = [...new Set([...target.aliases, ...oldNames])].filter((n) => n !== target.name);
    // 합칠 대상에 잔액이 없으면 이쪽 잔액을 가져간다
    const balance = target.balance === null ? (patch.balance ?? asset.balance) : null;
    check(await db.from("assets").update({ aliases, ...balanceFields(balance) }).eq("id", target.id));
    check(await db.from("assets").delete().eq("id", asset.id));
  } else {
    const aliases = name === asset.name ? asset.aliases : [...new Set([...asset.aliases, asset.name])].filter((n) => n !== name);
    const balance = patch.balance !== undefined && patch.balance !== asset.balance ? balanceFields(patch.balance) : {};
    const cleared = patch.balance === null && asset.balance !== null ? { balance: null, balance_updated_at: null } : {};
    check(await db.from("assets").update({ name, group_id: patch.groupId, aliases, ...balance, ...cleared }).eq("id", asset.id));
  }
  if (name !== asset.name) {
    check(await db.from("transactions").update({ method: name }).eq("method", asset.name));
    await refreshTxns();
  }
  await refreshSettings();
}

export async function deleteAsset(id: string) {
  check(await supabase().from("assets").delete().eq("id", id));
  await refreshSettings();
}

/** 자산 이름(과 뱅크샐러드 항목)으로 어느 그룹에 넣을지 추측한다. */
export function guessGroup(s: Settings, name: string, kind = ""): AssetGroup | undefined {
  const find = (re: RegExp) => s.groups.find((g) => re.test(g.name));
  const text = `${kind} ${name}`;
  return (
    (/카드/.test(text) && find(/카드/)) ||
    (/저축성|신탁|투자|연금|증권|적금|청약|세이프박스|저금통|펀드/.test(text) && find(/저축|투자/)) ||
    (/입출금|현금|전자금융|페이|머니|포인트|통장|은행|뱅크/.test(text) && find(/현금|예금|통장/)) ||
    find(/기타/) ||
    s.groups[0]
  );
}

export function findAsset(s: Settings, name: string): Asset | undefined {
  return s.assets.find((a) => a.name === name || a.aliases.includes(name));
}

/** 가져온 결제수단 중 자산에 없는 것을 이름으로 그룹을 추측해 추가한다. */
export async function ensureAssets(s: Settings, methods: string[]) {
  const missing = [...new Set(methods.filter((m) => m && !findAsset(s, m)))];
  if (!missing.length || !s.groups.length) return;
  const rows = missing.map((name, i) => {
    const g = guessGroup(s, name)!;
    return { group_id: g.id, name, sort: nextSort(s.assets.filter((a) => a.group_id === g.id)) + i };
  });
  check(await supabase().from("assets").insert(rows));
  await refreshSettings();
}

export interface AssetBalanceInput {
  name: string;
  kind?: string;
  balance: number;
}

/** 자산 잔액을 반영한다. 이름(별칭 포함)이 같은 자산은 잔액만 바꾸고, 없으면 새로 만든다. */
export async function applyAssetBalances(s: Settings, rows: AssetBalanceInput[]) {
  const db = supabase();
  const now = new Date().toISOString();
  const inserts: Record<string, unknown>[] = [];
  const nextByGroup = new Map<string, number>();
  for (const r of rows) {
    const existing = findAsset(s, r.name);
    if (existing) {
      check(await db.from("assets").update({ balance: r.balance, balance_updated_at: now }).eq("id", existing.id));
      continue;
    }
    const g = guessGroup(s, r.name, r.kind);
    if (!g) continue;
    const sort = nextByGroup.get(g.id) ?? nextSort(s.assets.filter((a) => a.group_id === g.id));
    nextByGroup.set(g.id, sort + 1);
    inserts.push({ group_id: g.id, name: r.name, sort, balance: r.balance, balance_updated_at: now });
  }
  if (inserts.length) check(await db.from("assets").insert(inserts));
  await refreshSettings();
}
