"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { NAV_ITEMS } from "@/config/nav";
import { NavLinks } from "./NavLinks";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Mobile hamburger + drawer (sm:hidden). Owns the open/close state.
 *
 * Renders the client islands (`NavLinks`, `LanguageSwitcher`) itself so a nav-link
 * tap can close the drawer via `onNavigate`. The server-async `NavAuth` and the
 * repo link can't be imported into this client module, so they're handed in as
 * ReactNode props (`auth`, `repoLink`) — already-rendered server markup.
 *
 * The panel is `absolute top-full` and resolves against the sticky `Navbar` root
 * (a positioned ancestor), so it spans the full bar width just below it. Closes
 * on Escape and on any nav-link tap.
 */
export function MobileMenu({
  auth,
  repoLink,
}: {
  auth: React.ReactNode;
  repoLink: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t("closeMenu") : t("openMenu")}
        className="relative z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
      >
        {open ? (
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 stroke-current" fill="none" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 stroke-current" fill="none" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full z-50 flex flex-col gap-4 border-b border-white/10 bg-zinc-950/95 px-5 py-4 backdrop-blur"
        >
          <NavLinks items={NAV_ITEMS} orientation="vertical" onNavigate={close} />
          <div className="border-t border-white/10 pt-4">{auth}</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
            {repoLink}
          </div>
        </div>
      )}
    </div>
  );
}
