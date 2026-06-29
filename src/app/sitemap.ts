import type { MetadataRoute } from "next";
import { getAllPublicUsernames } from "@/lib/db";
import { PUBLIC_INDEX_MIN_SCORE, SITE_URL } from "@/lib/site";

// Generate at request time, not at build: the profile query is a full scan of
// the `scores` table and can exceed Next's 60s build-time prerender limit,
// which aborts the whole production build. Cache the response for an hour so
// crawlers don't hit the DB on every fetch.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

// Hard ceiling on the profile query so a slow/unreachable DB can never hang the
// sitemap render — fall back to static routes only.
const PROFILE_QUERY_TIMEOUT_MS = 20_000;

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** zh lives at the root, en under `/en` — emit hreflang alternates for both. */
function entry(
  path: string,
  opts: { lastModified?: Date; changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"]; priority?: number } = {},
): MetadataRoute.Sitemap[number] {
  const zh = `${SITE_URL}${path}`;
  const en = `${SITE_URL}/en${path}`;
  return {
    url: zh,
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: { languages: { "zh-CN": zh, en } },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    entry("/", { changeFrequency: "daily", priority: 1 }),
    entry("/leaderboard", { changeFrequency: "hourly", priority: 0.9 }),
  ];

  // Indexable profiles (non-hidden, score ≥ floor). Below-floor pages omitted.
  const profiles = await withTimeout(
    getAllPublicUsernames(PUBLIC_INDEX_MIN_SCORE),
    PROFILE_QUERY_TIMEOUT_MS,
    [],
  );
  const profileRoutes: MetadataRoute.Sitemap = profiles.map((p) =>
    entry(`/u/${p.username}`, {
      lastModified: p.scanned_at ? new Date(p.scanned_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );

  return [...staticRoutes, ...profileRoutes];
}
