"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { formatNumber } from "@/lib/format";
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
import { Button, LoadError, PageHeader, TextInput } from "../ui";

type Editing =
  | { kind: "group"; group?: AssetGroup }
  | { kind: "asset"; asset?: Asset; groupId: string };

export function AssetsScreen() {
  const { data: settings, error } = useSettings();
  const [editing, setEditing] = useState<Editing | null>(null);

  if (error) return <LoadError />;
  if (!settings) return null;
  const sum = (list: Asset[]) => list.reduce((n, a) => n + (a.balance ?? 0), 0);
  const plus = settings.assets.reduce((n, a) => n + Math.max(a.balance ?? 0, 0), 0);
  const minus = settings.assets.reduce((n, a) => n + Math.min(a.balance ?? 0, 0), 0);
  const updated = settings.assets.map((a) => a.balance_updated_at).filter(Boolean).sort().at(-1);

  return (
    <>
      <PageHeader
        title="자산"
        right={
          <button aria-label="그룹 추가" onClick={() => setEditing({ kind: "group" })} className="text-ink-2">
            <Plus size={24} />
          </button>
        }
      />
      <div className="mx-4 mb-1 grid grid-cols-3 rounded-3xl bg-surface py-4 text-center">
        <div>
          <p className="text-[13px] text-ink-3">자산</p>
          <p className="num mt-1 text-[16px] font-bold text-income">{formatNumber(plus)}</p>
        </div>
        <div className="border-x border-line">
          <p className="text-[13px] text-ink-3">부채</p>
          <p className="num mt-1 text-[16px] font-bold text-danger">{formatNumber(minus)}</p>
        </div>
        <div>
          <p className="text-[13px] text-ink-3">합계</p>
          <p className="num mt-1 text-[16px] font-bold">{formatNumber(plus + minus)}</p>
        </div>
      </div>
      <p className="mb-3 px-5 text-right text-[12px] text-ink-3">
        {updated
          ? `잔액 기준 ${new Date(updated).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`
          : "잔액은 뱅크샐러드 자산 현황을 가져오거나 직접 입력해요"}
      </p>
      <div className="space-y-3">
        {settings.groups.map((g) => {
          const assets = settings.assets.filter((a) => a.group_id === g.id);
          return (
            <section key={g.id} className="mx-4 overflow-hidden rounded-3xl bg-surface">
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <span className="text-[18px]">{g.emoji}</span>
                <span className="flex-1 text-[15px] font-semibold">{g.name}</span>
                {assets.some((a) => a.balance !== null) && (
                  <span className={`num text-[14px] font-semibold ${tone(sum(assets))}`}>{formatNumber(sum(assets))}원</span>
                )}
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
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  {a.balance !== null && (
                    <span className={`num ml-3 shrink-0 font-medium ${tone(a.balance)}`}>{formatNumber(a.balance)}원</span>
                  )}
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
        카드 미결제금처럼 갚아야 할 돈은 잔액을 -로 넣으면 부채로 잡혀요. 가져온 내역의 결제수단은 자동으로 여기에 추가돼요. 이름을 바꾸면 예전 이름은 별칭으로 남아서 다음에 가져올 때도 같은
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

/** 잔액 색: 양수 파랑, 음수(부채) 빨강, 0 회색 */
function tone(n: number) {
  return n > 0 ? "text-income" : n < 0 ? "text-danger" : "text-ink-3";
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
  const [balance, setBalance] = useState(asset?.balance ?? null);
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
      <div className="mt-2 flex h-12 items-center rounded-2xl bg-surface-2 px-4">
        <span className="shrink-0 text-[14px] text-ink-3">잔액</span>
        <input
          inputMode="numeric"
          aria-label="잔액"
          value={balance === null ? "" : `${balance < 0 ? "-" : ""}${formatNumber(Math.abs(balance))}`}
          onChange={(e) => {
            const v = e.target.value.trim();
            const digits = v.replace(/\D/g, "").slice(0, 15);
            setBalance(digits === "" ? null : Number(digits) * (v.startsWith("-") ? -1 : 1));
          }}
          placeholder="모름"
          className="num min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-ink-3"
        />
        <span className="ml-1 text-ink-2">원</span>
      </div>
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
            run(
              () =>
                asset
                  ? updateAsset(settings, asset, { name, groupId: group, balance })
                  : addAsset(settings, group, name, balance),
              onClose,
            )
          }
        >
          {asset ? "저장" : "추가"}
        </Button>
      </div>
    </div>
  );
}
