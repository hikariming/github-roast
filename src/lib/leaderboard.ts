import {
  getHeatLeaderboard,
  getLeaderboard,
  getProgressLeaderboard,
  getTrendingLeaderboard,
  type LeaderboardEntry,
} from "@/lib/db";
import {
  getCachedLeaderboard,
  setCachedLeaderboard,
  type LeaderboardCacheView,
} from "@/lib/redis";

// One source of truth for "how many rows a board holds". The full /leaderboard
// page wants the long list; the home page slices what it needs off the same
// cached payload, so both share a single Redis entry per view.
export const LEADERBOARD_LIMIT = 500;

const fetchers: Record<
  LeaderboardCacheView,
  (limit?: number) => Promise<LeaderboardEntry[]>
> = {
  trending: getTrendingLeaderboard,
  score: getLeaderboard,
  heat: getHeatLeaderboard,
  progress: getProgressLeaderboard,
};

/**
 * Cache-aside leaderboard read shared by the home page (SSR) and the
 * /api/leaderboard route. A hit serves entirely from Redis — no DB query — so
 * the expensive triple LEFT JOIN only runs once per view per TTL window.
 */
export async function getLeaderboardCached(
  view: LeaderboardCacheView = "trending",
): Promise<{ entries: LeaderboardEntry[]; cached: boolean }> {
  const cached = await getCachedLeaderboard(view);
  if (cached) return { entries: cached, cached: true };
  const entries = await fetchers[view](LEADERBOARD_LIMIT);
  await setCachedLeaderboard(entries, view);
  return { entries, cached: false };
}
