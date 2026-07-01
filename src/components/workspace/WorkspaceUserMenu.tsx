"use client";

import { ArrowUpRight, Languages, LogOut, Palette, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

type WorkspaceUserMenuProps = {
  image: string | null;
  login: string;
  scored: boolean;
};

function avatarFallback(login: string) {
  return login.trim().charAt(0).toUpperCase() || "G";
}

export function WorkspaceUserMenu({ image, login, scored }: WorkspaceUserMenuProps) {
  const tHeader = useTranslations("header");
  const tLang = useTranslations("langSwitch");
  const tTheme = useTranslations("themeSwitch");
  const targetHref = scored
    ? `/u/${login}`
    : `/?username=${encodeURIComponent(`https://github.com/${login}`)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={login}
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.03] shadow-sm transition-colors hover:bg-white/[0.06]"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={login} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-zinc-100">{avatarFallback(login)}</span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[18.5rem] rounded-2xl border-white/10 bg-popover/98 p-1.5 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={login} className="h-full w-full object-cover" />
            ) : (
              <span className="text-base font-semibold text-zinc-100">{avatarFallback(login)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-zinc-100">@{login}</div>
            <div className="truncate text-xs text-zinc-500">github.com/{login}</div>
          </div>
        </div>

        <DropdownMenuSeparator className="mx-1 bg-white/10" />

        <DropdownMenuItem asChild>
          <Link
            href={targetHref}
            className="flex items-center justify-between rounded-xl px-3 py-2.5"
          >
            <span className="flex items-center gap-2.5">
              <UserRound className="h-4 w-4 text-zinc-300" />
              <span>{scored ? tHeader("myProfile") : tHeader("judgeSelf")}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 text-zinc-500" />
          </Link>
        </DropdownMenuItem>

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

        <DropdownMenuSeparator className="mx-1 bg-white/10" />

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
          className="rounded-xl px-3 py-2.5"
        >
          <span className="flex items-center gap-2.5">
            <LogOut className="h-4 w-4 text-zinc-300" />
            <span>{tHeader("signOut")}</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
