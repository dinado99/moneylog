"use client";

import { useCallback } from "react";
import { paletteColor } from "./categories";
import { useSettings } from "./settings-db";
import type { TxnType } from "./types";

export interface CategoryLook {
  emoji: string | null;
  color: string;
}

/** 분류 이름 → 이모지와 색. 색은 분류 순서로 정해서 설정에서 순서를 바꾸면 같이 바뀐다. */
export function useCategoryLook() {
  const { data } = useSettings();
  return useCallback(
    (type: TxnType, name: string): CategoryLook => {
      if (type === "transfer") return { emoji: "🔁", color: "#8A94A6" };
      const mains = (data?.categories ?? []).filter((c) => c.type === type && !c.parent_id);
      const i = mains.findIndex((c) => c.name === name);
      return { emoji: mains[i]?.emoji ?? null, color: paletteColor(i) };
    },
    [data],
  );
}
