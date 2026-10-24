"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartPie, House, ListOrdered, Settings, WalletCards } from "lucide-react";

const TABS = [
  { href: "/", label: "홈", icon: House },
  { href: "/history", label: "내역", icon: ListOrdered },
  { href: "/stats", label: "통계", icon: ChartPie },
  { href: "/assets", label: "자산", icon: WalletCards },
  { href: "/settings", label: "설정", icon: Settings },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active ? "text-ink" : "text-ink-3"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
