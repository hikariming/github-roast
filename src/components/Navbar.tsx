import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { NAV_ITEMS } from "@/config/nav";
import { NavLinks } from "./NavLinks";
import { NavAuth } from "./NavAuth";
import { MobileMenu } from "./MobileMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Site-wide navigation bar. Server component that composes client islands
 * (`NavLinks`, `LanguageSwitcher`, `MobileMenu`) and the server `NavAuth` slot.
 *
 * Sticky top bar — `position: sticky` works inside the layout's
 * `body min-h-full flex flex-col` without changes, and (being a positioned
 * ancestor) anchors the mobile drawer's `absolute top-full` panel to full width.
 *
 * `NavAuth` returns null when OAuth isn't configured; the right cluster is a
 * `flex gap` row so the missing child leaves no empty gap.
 */
export async function Navbar() {
  const tNav = await getTranslations("nav");
  const tRepo = await getTranslations("repoLink");

  const repoLink = (
    <a
      href="https://github.com/hikariming/github-roast"
      target="_blank"
      rel="noopener noreferrer"
      title={tRepo("title")}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      {tRepo("label")}
    </a>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-5">
        {/* Brand */}
        <Link
          href="/"
          className="shrink-0 text-base font-black tracking-tight text-zinc-100 transition-colors hover:text-white"
        >
          <span className="text-orange-500">🔥</span> {tNav("brand")}
        </Link>

        {/* Desktop primary nav */}
        <div className="hidden sm:flex">
          <NavLinks items={NAV_ITEMS} />
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <NavAuth />
            <ThemeToggle />
            <LanguageSwitcher />
            {repoLink}
          </div>

          {/* Mobile: hamburger + drawer. NavAuth (server) + repo link handed in
              as props; MobileMenu renders its own client islands so a link tap
              can close the drawer. */}
          <MobileMenu auth={<NavAuth />} repoLink={repoLink} />
        </div>
      </div>
    </header>
  );
}
