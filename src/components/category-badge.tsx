"use client";

import { useCategoryLook } from "@/lib/category-look";
import type { TxnType } from "@/lib/types";

export function CategoryBadge({ type, name, size = 40 }: { type: TxnType; name: string; size?: number }) {
  const { emoji, color } = useCategoryLook()(type, name);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[14px] font-semibold"
      // 이모지가 있으면 중립 배경(차트 범주색과 헷갈리지 않게), 없으면 첫 글자에 옅은 색
      style={{
        width: size,
        height: size,
        background: emoji ? "var(--surface-2)" : `${color}1f`,
        color,
        fontSize: emoji ? size * 0.5 : 13,
      }}
    >
      {emoji ?? name.charAt(0)}
    </span>
  );
}
