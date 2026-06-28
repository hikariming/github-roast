import type { MetadataRoute } from "next";
import { getAllPaperIds, getAllPublicUsernames } from "@/lib/db";
import { PUBLIC_INDEX_MIN_SCORE, SITE_URL } from "@/lib/site";

// Re-generate at most hourly — new profiles are scored continuously, but the
// sitemap doesn't need to be fresher than the ISR profile pages it points to.
export const revalidate = 3600;

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
    entry("/arxiv", { changeFrequency: "weekly", priority: 0.8 }),
    entry("/arxiv/leaderboard", { changeFrequency: "daily", priority: 0.8 }),
  ];

  const [profiles, papers] = await Promise.all([
    // Indexable profiles (non-hidden, score ≥ floor). Below-floor pages omitted.
    getAllPublicUsernames(PUBLIC_INDEX_MIN_SCORE),
    getAllPaperIds(),
  ]);
  const profileRoutes: MetadataRoute.Sitemap = profiles.map((p) =>
    entry(`/u/${p.username}`, {
      lastModified: p.scanned_at ? new Date(p.scanned_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );
  const paperRoutes: MetadataRoute.Sitemap = papers.map((p) =>
    entry(`/arxiv/${p.arxiv_id}`, {
      lastModified: p.scored_at ? new Date(p.scored_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );

  return [...staticRoutes, ...profileRoutes, ...paperRoutes];
}
