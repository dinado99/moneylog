"use client";

import { useCategoryLook } from "@/lib/category-look";
import type { TxnType } from "@/lib/types";

export function CategoryBadge({ type, name, size = 40 }: { type: TxnType; name: string; size?: number }) {
  const { emoji, color } = useCategoryLook()(type, name);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[14px] font-semibold"
      style={{ width: size, height: size, background: `${color}1f`, color, fontSize: emoji ? size * 0.5 : 13 }}
    >
      {emoji ?? name.charAt(0)}
    </span>
  );
}
