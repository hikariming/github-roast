"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Auto-backfills a scored profile's missing evidence snapshot (contributed
 * repos, languages, topics) on visit. Rendered by the detail page only when
 * `getProfileSnapshot` returned null. Fires once, and on success refreshes the
 * server-rendered page so the freshly fetched sections appear.
 */
export function ProfileBackfill({ username }: { username: string }) {
  const t = useTranslations("detail");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // guard against StrictMode double-invoke
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/profile/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.filled) {
          router.refresh();
          return; // keep the indicator until the refreshed render drops us
        }
      } catch {
        /* network/fetch error — fall through to hide the indicator */
      }
      setLoading(false);
    })();
  }, [username, router]);

  if (!loading) return null;
  return (
    <div className="mb-6 flex items-center gap-2 rounded-2xl border border-amber-300/15 bg-amber-500/[0.04] px-4 py-3 text-sm text-amber-200/90">
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-200" />
      {t("backfilling")}
    </div>
  );
}
