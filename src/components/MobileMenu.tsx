"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { NAV_ITEMS } from "@/config/nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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

  return (
    <div className="sm:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t("closeMenu") : t("openMenu")}
          className="relative z-50 rounded-full border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        <SheetContent
          id="mobile-menu"
          side="top"
          className="top-14 rounded-b-2xl border-b border-white/10 bg-popover/98 px-5 pb-5 pt-14 backdrop-blur-xl"
        >
          <NavLinks items={NAV_ITEMS} orientation="vertical" onNavigate={close} />
          <div className="mt-4 border-t border-white/10 pt-4">{auth}</div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
            {repoLink}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
