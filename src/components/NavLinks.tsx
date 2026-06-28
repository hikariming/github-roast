"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { NavItem } from "@/config/nav";

/**
 * Primary nav links with active-state highlighting + dropdown submenus. Client
 * island: active state needs the current path. Uses `usePathname` from
 * `@/i18n/navigation` (NOT `next/navigation`) — locale-stripped, so
 * `/en/leaderboard` still matches an item whose `href` is `/leaderboard`.
 *
 * Items with `children` render as a dropdown parent: a CSS hover/focus panel on
 * desktop, and an inline indented group in the mobile (vertical) drawer.
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
  const vertical = orientation === "vertical";

  const isActive = (item: NavItem) =>
    item.href
      ? item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`)
      : false;
  const groupActive = (item: NavItem) =>
    isActive(item) || (item.children ?? []).some(isActive);

  const badge = (item: NavItem) =>
    item.badge ? (
      <span className="ml-1.5 rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
        {item.badge}
      </span>
    ) : null;

  const linkItem = (item: NavItem) => {
    const active = isActive(item);
    return (
      <Link
        key={item.key}
        href={item.href ?? "/"}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
          vertical ? "w-full" : ""
        } ${
          active
            ? "border-white/10 bg-white/10 font-medium text-zinc-100"
            : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
        }`}
      >
        {t(item.key)}
        {badge(item)}
      </Link>
    );
  };

  const dropdown = (item: NavItem) => {
    const active = groupActive(item);
    const children = item.children ?? [];
    if (vertical) {
      return (
        <div key={item.key} className="flex flex-col gap-1">
          <span className="px-3 pt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t(item.key)}
          </span>
          {children.map((c) => linkItem(c))}
        </div>
      );
    }
    return (
      <div key={item.key} className="group relative">
        <button
          type="button"
          aria-haspopup="menu"
          className={`flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
            active
              ? "border-white/10 bg-white/10 font-medium text-zinc-100"
              : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          }`}
        >
          {t(item.key)}
          <svg viewBox="0 0 20 20" className="ml-1 h-3.5 w-3.5 fill-current opacity-70" aria-hidden>
            <path d="M5.5 7.5l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
        <div className="invisible absolute left-0 top-full z-50 min-w-[12rem] pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-xl">
            {children.map((c) => linkItem(c))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <nav className={vertical ? "flex flex-col gap-1" : "flex items-center gap-1"}>
      {items.map((item) => (item.children ? dropdown(item) : linkItem(item)))}
    </nav>
  );
}
