"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import {
  addAsset,
  addGroup,
  deleteAsset,
  deleteGroup,
  moveItem,
  updateAsset,
  updateGroup,
  useSettings,
  type Asset,
  type AssetGroup,
  type Settings,
} from "@/lib/settings-db";
import { Sheet } from "../sheet";
import { BackHeader, Button, LoadError, TextInput } from "../ui";

type Editing =
  | { kind: "group"; group?: AssetGroup }
  | { kind: "asset"; asset?: Asset; groupId: string };

export function AssetSettingsScreen() {
  const { data: settings, error } = useSettings();
  const [editing, setEditing] = useState<Editing | null>(null);

  if (error) return <LoadError />;
  if (!settings) return null;

  return (
    <>
      <BackHeader
        title="자산"
        href="/settings"
        right={
          <button aria-label="그룹 추가" onClick={() => setEditing({ kind: "group" })} className="text-ink-2">
            <Plus size={24} />
          </button>
        }
      />
      <div className="space-y-3">
        {settings.groups.map((g) => {
          const assets = settings.assets.filter((a) => a.group_id === g.id);
          return (
            <section key={g.id} className="mx-4 overflow-hidden rounded-3xl bg-surface">
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <span className="text-[18px]">{g.emoji}</span>
                <span className="flex-1 text-[15px] font-semibold">{g.name}</span>
                <button
                  aria-label={`${g.name} 그룹 수정`}
                  onClick={() => setEditing({ kind: "group", group: g })}
                  className="grid size-8 place-items-center rounded-full text-ink-3 active:bg-surface-2"
                >
                  <Pencil size={16} />
                </button>
              </div>
              {assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setEditing({ kind: "asset", asset: a, groupId: g.id })}
                  className="flex w-full items-center border-t border-line px-5 py-3.5 text-left text-[15px] active:bg-surface-2"
                >
                  <span className="flex-1 truncate">{a.name}</span>
                  {a.aliases.length > 0 && <span className="ml-2 text-[12px] text-ink-3">별칭 {a.aliases.length}</span>}
                </button>
              ))}
              <button
                onClick={() => setEditing({ kind: "asset", groupId: g.id })}
                className="flex w-full items-center gap-1 border-t border-line px-5 py-3.5 text-[14px] font-medium text-accent active:bg-surface-2"
              >
                <Plus size={16} /> 자산 추가
              </button>
            </section>
          );
        })}
      </div>
      <p className="mx-5 mt-3 text-[13px] leading-relaxed text-ink-3">
        가져온 내역의 결제수단은 자동으로 여기에 추가돼요. 이름을 바꾸면 예전 이름은 별칭으로 남아서 다음에 가져올 때도 같은
        자산으로 인식해요. 이미 있는 자산 이름으로 바꾸면 둘이 합쳐져요.
      </p>

      <Sheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing?.kind === "group" && (
          <GroupForm key={editing.group?.id ?? "new"} settings={settings} group={editing.group} onClose={() => setEditing(null)} />
        )}
        {editing?.kind === "asset" && (
          <AssetForm
            key={editing.asset?.id ?? `new-${editing.groupId}`}
            settings={settings}
            asset={editing.asset}
            groupId={editing.groupId}
            onClose={() => setEditing(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function useRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
    } catch (e) {
      setError(e instanceof Error && /duplicate|unique/i.test(e.message) ? "같은 이름이 이미 있어요." : "저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function MoveButtons({ busy, canUp, canDown, onMove }: { busy: boolean; canUp: boolean; canDown: boolean; onMove: (d: -1 | 1) => void }) {
  return (
    <div className="mt-4 flex gap-2">
      <Button variant="secondary" className="h-11 flex-1 text-[14px]" disabled={busy || !canUp} onClick={() => onMove(-1)}>
        <ChevronUp size={16} className="mr-1 inline" />
        위로
      </Button>
      <Button variant="secondary" className="h-11 flex-1 text-[14px]" disabled={busy || !canDown} onClick={() => onMove(1)}>
        <ChevronDown size={16} className="mr-1 inline" />
        아래로
      </Button>
    </div>
  );
}

function GroupForm({ settings, group, onClose }: { settings: Settings; group?: AssetGroup; onClose: () => void }) {
  const [emoji, setEmoji] = useState(group?.emoji ?? "");
  const [name, setName] = useState(group?.name ?? "");
  const { busy, error, run } = useRunner();
  const index = group ? settings.groups.findIndex((g) => g.id === group.id) : -1;
  const count = group ? settings.assets.filter((a) => a.group_id === group.id).length : 0;

  return (
    <div className="px-5 pb-5">
      <p className="text-[17px] font-semibold">{group ? "자산 그룹 수정" : "자산 그룹 추가"}</p>
      <div className="mt-4 flex gap-2">
        <TextInput aria-label="이모지" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="💰" className="w-16 shrink-0 text-center text-[20px]" />
        <TextInput aria-label="이름" value={name} onChange={(e) => setName(e.target.value)} placeholder="그룹 이름" className="flex-1" />
      </div>
      {group && (
        <MoveButtons
          busy={busy}
          canUp={index > 0}
          canDown={index < settings.groups.length - 1}
          onMove={(d) => run(() => moveItem("asset_groups", settings.groups, group, d))}
        />
      )}
      {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}
      <div className="mt-6 flex gap-2">
        {group && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              confirm(`'${group.name}' 그룹을 삭제할까요?${count ? ` 안에 있는 자산 ${count}개도 같이 삭제돼요.` : ""}`) &&
              run(() => deleteGroup(group.id), onClose)
            }
          >
            삭제
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!name.trim() || busy}
          onClick={() => run(() => (group ? updateGroup(group, { name, emoji }) : addGroup(settings, name, emoji)), onClose)}
        >
          {group ? "저장" : "추가"}
        </Button>
      </div>
    </div>
  );
}

function AssetForm({ settings, asset, groupId, onClose }: { settings: Settings; asset?: Asset; groupId: string; onClose: () => void }) {
  const [name, setName] = useState(asset?.name ?? "");
  const [group, setGroup] = useState(groupId);
  const { busy, error, run } = useRunner();
  const siblings = settings.assets.filter((a) => a.group_id === groupId);
  const index = asset ? siblings.findIndex((a) => a.id === asset.id) : -1;
  const mergeTarget = asset && settings.assets.find((a) => a.id !== asset.id && a.name === name.trim());

  return (
    <div className="px-5 pb-5">
      <p className="text-[17px] font-semibold">{asset ? "자산 수정" : "자산 추가"}</p>
      <TextInput className="mt-4 w-full" aria-label="이름" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 우리은행, 삼성카드" />
      <select
        aria-label="그룹"
        value={group}
        onChange={(e) => setGroup(e.target.value)}
        className="mt-2 h-12 w-full appearance-none rounded-2xl bg-surface-2 px-4 outline-none"
      >
        {settings.groups.map((g) => (
          <option key={g.id} value={g.id}>
            {`${g.emoji ?? ""} ${g.name}`.trim()}
          </option>
        ))}
      </select>
      {asset && asset.aliases.length > 0 && (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-3">가져오기 별칭: {asset.aliases.join(", ")}</p>
      )}
      {mergeTarget && <p className="mt-3 text-[13px] text-accent">저장하면 &apos;{mergeTarget.name}&apos;과 하나로 합쳐져요.</p>}
      {asset && (
        <MoveButtons
          busy={busy}
          canUp={index > 0}
          canDown={index < siblings.length - 1}
          onMove={(d) => run(() => moveItem("assets", siblings, asset, d))}
        />
      )}
      {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}
      <div className="mt-6 flex gap-2">
        {asset && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => confirm(`'${asset.name}'을 삭제할까요? 내역은 그대로 남아요.`) && run(() => deleteAsset(asset.id), onClose)}
          >
            삭제
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!name.trim() || busy}
          onClick={() =>
            run(() => (asset ? updateAsset(settings, asset, { name, groupId: group }) : addAsset(settings, group, name)), onClose)
          }
        >
          {asset ? "저장" : "추가"}
        </Button>
      </div>
    </div>
  );
}
