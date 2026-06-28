"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { NavItem } from "@/config/nav";

/**
 * Primary nav links with active-state highlighting. Client island: active state
 * needs the current path. Uses `usePathname` from `@/i18n/navigation` (NOT
 * `next/navigation`) — it returns the locale-stripped path, so `/en/leaderboard`
 * still matches an item whose `href` is `/leaderboard`.
 *
 * Shared by the desktop bar and the mobile drawer; `orientation` switches layout.
 * Receives the serializable `NAV_ITEMS` config and resolves labels via the `nav`
 * namespace here, so only plain data crosses the server→client boundary.
 */
export function NavLinks({
  items,
  orientation = "horizontal",
  onNavigate,
}: {
  items: NavItem[];
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <nav
      className={
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : "flex items-center gap-1"
      }
    >
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              orientation === "vertical" ? "w-full" : ""
            } ${
              active
                ? "border-white/10 bg-white/10 font-medium text-zinc-100"
                : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
