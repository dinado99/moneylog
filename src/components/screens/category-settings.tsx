"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Plus, X } from "lucide-react";
import {
  addCategory,
  deleteCategory,
  mainCategories,
  moveItem,
  updateCategory,
  useSettings,
  type Category,
  type MainCategory,
  type Settings,
} from "@/lib/settings-db";
import { Sheet } from "../sheet";
import { BackHeader, Button, Card, LoadError, TextInput } from "../ui";

type Kind = "expense" | "income";

export function CategorySettingsScreen({ type }: { type: Kind }) {
  const { data: settings, error } = useSettings();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const title = type === "expense" ? "지출 분류" : "수입 분류";

  if (error) return <LoadError />;
  if (!settings) return null;
  const mains = mainCategories(settings, type);
  const current = mains.find((m) => m.id === editing);

  return (
    <>
      <BackHeader
        title={title}
        href="/settings"
        right={
          <button aria-label="분류 추가" onClick={() => setEditing("new")} className="text-ink-2">
            <Plus size={24} />
          </button>
        }
      />
      <Card className="overflow-hidden">
        {mains.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setEditing(m.id)}
            className={`flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-surface-2 ${i ? "border-t border-line" : ""}`}
          >
            <span className="w-7 text-center text-[22px]">{m.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">
                {m.name}
                {m.subs.length > 0 && <span className="ml-1 text-ink-3">({m.subs.length})</span>}
              </span>
              {m.subs.length > 0 && (
                <span className="block truncate text-[13px] text-ink-3">{m.subs.map((s) => s.name).join(", ")}</span>
              )}
            </span>
            <ChevronRight size={18} className="text-ink-3" />
          </button>
        ))}
        {!mains.length && <p className="py-10 text-center text-[15px] text-ink-3">분류가 없어요</p>}
      </Card>
      <p className="mx-5 mt-3 text-[13px] leading-relaxed text-ink-3">
        분류 이름을 바꾸면 이미 저장된 내역도 같이 바뀌어요. 분류를 지워도 내역은 그대로 남아요.
      </p>

      <Sheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing !== null && (
          <CategoryForm
            key={editing}
            type={type}
            settings={settings}
            mains={mains}
            current={current}
            onCreated={(id) => setEditing(id)}
            onClose={() => setEditing(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function CategoryForm({
  type,
  settings,
  mains,
  current,
  onCreated,
  onClose,
}: {
  type: Kind;
  settings: Settings;
  mains: MainCategory[];
  current?: MainCategory;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const [emoji, setEmoji] = useState(current?.emoji ?? "");
  const [name, setName] = useState(current?.name ?? "");
  const [newSub, setNewSub] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error && /duplicate|unique/i.test(e.message) ? "같은 이름이 이미 있어요." : "저장하지 못했어요.");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      if (current) {
        await updateCategory(settings, current, { name, emoji: emoji.trim() || null });
        onClose();
      } else {
        const created = await addCategory(settings, { type, name, emoji: emoji.trim() || null });
        onCreated(created.id);
      }
    }).catch(() => {});

  const addSub = () =>
    current &&
    newSub.trim() &&
    run(async () => {
      await addCategory(settings, { type, name: newSub, parentId: current.id });
      setNewSub("");
    }).catch(() => {});

  const renameSub = (sub: Category) => {
    const next = prompt("소분류 이름", sub.name)?.trim();
    if (next && next !== sub.name) run(() => updateCategory(settings, sub, { name: next })).catch(() => {});
  };

  const removeSub = (sub: Category) => {
    if (confirm(`'${sub.name}' 소분류를 삭제할까요?`)) run(() => deleteCategory(sub.id)).catch(() => {});
  };

  const remove = () => {
    if (!current) return;
    if (!confirm(`'${current.name}' 분류를 삭제할까요?${current.subs.length ? " 소분류도 같이 삭제돼요." : ""}`)) return;
    run(() => deleteCategory(current.id))
      .then(onClose)
      .catch(() => {});
  };

  const index = current ? mains.findIndex((m) => m.id === current.id) : -1;

  return (
    <div className="px-5 pb-5">
      <p className="text-[17px] font-semibold">{current ? "분류 수정" : "분류 추가"}</p>
      <div className="mt-4 flex gap-2">
        <TextInput
          aria-label="이모지"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🙂"
          className="w-16 shrink-0 text-center text-[20px]"
        />
        <TextInput aria-label="이름" value={name} onChange={(e) => setName(e.target.value)} placeholder="분류 이름" className="flex-1" />
      </div>

      {current && (
        <div className="mt-6">
          <p className="text-[13px] text-ink-3">소분류 · 눌러서 이름 바꾸기</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {current.subs.map((sub) => (
              <span key={sub.id} className="flex h-8 items-center rounded-full bg-surface-2 pl-3 text-[14px]">
                <button onClick={() => renameSub(sub)}>{sub.name}</button>
                <button aria-label={`${sub.name} 삭제`} onClick={() => removeSub(sub)} className="grid h-8 w-8 place-items-center text-ink-3">
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <TextInput
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSub()}
              placeholder="소분류 추가"
              className="flex-1"
            />
            <Button variant="secondary" className="h-12 shrink-0" disabled={!newSub.trim() || busy} onClick={addSub}>
              추가
            </Button>
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              variant="secondary"
              className="h-11 flex-1 text-[14px]"
              disabled={busy || index <= 0}
              onClick={() => run(() => moveItem("categories", mains, current, -1)).catch(() => {})}
            >
              <ChevronUp size={16} className="mr-1 inline" />
              위로
            </Button>
            <Button
              variant="secondary"
              className="h-11 flex-1 text-[14px]"
              disabled={busy || index >= mains.length - 1}
              onClick={() => run(() => moveItem("categories", mains, current, 1)).catch(() => {})}
            >
              <ChevronDown size={16} className="mr-1 inline" />
              아래로
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}
      <div className="mt-6 flex gap-2">
        {current && (
          <Button variant="danger" disabled={busy} onClick={remove}>
            삭제
          </Button>
        )}
        <Button className="flex-1" disabled={!name.trim() || busy} onClick={save}>
          {current ? "저장" : "추가"}
        </Button>
      </div>
    </div>
  );
}
