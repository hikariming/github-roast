import { getTranslations } from "next-intl/server";
import { auth, authConfigured, signIn, signOut } from "@/lib/auth";

/**
 * GitHub login control for the navbar. Server component: reads the session via
 * `auth()` and renders nothing when GitHub OAuth isn't configured, so the app
 * degrades cleanly without the AUTH_* env vars (matching the redis/turso style).
 * Because it returns `null` when unconfigured, the navbar's right cluster (a
 * `flex gap` row) collapses the missing child with no empty gap.
 *
 * Extracted from the former `SiteHeader` — same markup minus the `<header>`
 * wrapper, now using i18n strings instead of hardcoded Chinese.
 */
export async function NavAuth() {
  if (!authConfigured()) return null;
  const t = await getTranslations("header");
  const session = await auth();
  const user = session?.user;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.login}
            className="h-7 w-7 rounded-full ring-1 ring-white/15"
          />
        ) : null}
        <span className="text-sm text-zinc-300">@{user.login}</span>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button
            type="submit"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 hover:bg-white/10"
          >
            {t("signOut")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("github");
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 fill-current">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
        {t("signIn")}
      </button>
    </form>
  );
}
