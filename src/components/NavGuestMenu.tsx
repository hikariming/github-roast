"use client";

import { Languages, Palette, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

export function NavGuestMenu() {
  const tLang = useTranslations("langSwitch");
  const tTheme = useTranslations("themeSwitch");
  const triggerLabel = `${tLang("label")} / ${tTheme("label")}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          title={triggerLabel}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 shadow-sm transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[18rem] rounded-2xl border-white/10 bg-popover/98 p-1.5 shadow-2xl backdrop-blur-xl"
      >
        <div className="rounded-xl bg-white/[0.03] px-3 py-3">
          <div className="text-sm font-semibold text-zinc-100">{triggerLabel}</div>
          <div className="mt-1 text-xs text-zinc-500">ghfind</div>
        </div>

        <DropdownMenuSeparator className="mx-1 bg-white/10" />

        <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
          <span className="flex items-center gap-2.5 text-sm text-zinc-300">
            <Languages className="h-4 w-4 text-zinc-300" />
            {tLang("label")}
          </span>
          <LanguageSwitcher />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
          <span className="flex items-center gap-2.5 text-sm text-zinc-300">
            <Palette className="h-4 w-4 text-zinc-300" />
            {tTheme("label")}
          </span>
          <ThemeToggle />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
