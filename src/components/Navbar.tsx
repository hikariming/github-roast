import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { authConfigured } from "@/lib/auth";
import { NAV_ITEMS } from "@/config/nav";
import { NavLinks } from "./NavLinks";
import { NavAuth } from "./NavAuth";
import { MobileMenu } from "./MobileMenu";
import { BrandMark } from "./BrandMark";

/**
 * Site-wide top bar. Keep the public-site feel: plain brand on the left, normal
 * navigation links in the middle, account/source actions on the right.
 */
export async function Navbar() {
  const tNav = await getTranslations("nav");
  const tRepo = await getTranslations("repoLink");
  const oauthConfigured = authConfigured();

  const repoLink = (
    <a
      href="https://github.com/hikariming/github-roast"
      target="_blank"
      rel="noopener noreferrer"
      title={tRepo("title")}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 shadow-sm transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      {tRepo("label")}
    </a>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-white/[0.03] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-5 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 text-[1.35rem] font-black leading-none tracking-tight text-zinc-100 transition-colors hover:text-white"
        >
          <BrandMark className="size-7 shrink-0 transition-transform group-hover:rotate-3" />
          {tNav("brand")}
        </Link>

        <div className="hidden min-w-0 flex-1 lg:flex">
          <NavLinks items={NAV_ITEMS} />
        </div>

        <div className="ml-auto flex items-center justify-end gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <NavAuth configured={oauthConfigured} />
            {repoLink}
          </div>

          <MobileMenu auth={<NavAuth configured={oauthConfigured} />} repoLink={repoLink} />
        </div>
      </div>
    </header>
  );
}
