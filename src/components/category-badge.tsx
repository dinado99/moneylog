import { categoryColor } from "@/lib/categories";

export function CategoryBadge({ name, size = 40 }: { name: string; size?: number }) {
  const color = categoryColor(name);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[14px] text-[13px] font-semibold"
      style={{ width: size, height: size, background: `${color}1f`, color }}
    >
      {name.charAt(0)}
    </span>
  );
}
