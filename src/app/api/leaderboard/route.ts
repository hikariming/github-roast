import { NextRequest, NextResponse } from "next/server";
import { getLeaderboardCached } from "@/lib/leaderboard";
import type { LeaderboardCacheView } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CDN-cache the whole payload so most visitors are served from Vercel's edge
// without invoking the function at all (the big lever on the serverless bill).
// stale-while-revalidate keeps it instant while one background request refreshes.
const CDN_CACHE = "public, s-maxage=120, stale-while-revalidate=600";

function leaderboardView(req: NextRequest): LeaderboardCacheView {
  const view = req.nextUrl.searchParams.get("view");
  if (view === "score") return "score";
  if (view === "heat") return "heat";
  if (view === "progress") return "progress";
  return "trending";
}

export async function GET(req: NextRequest) {
  const view = leaderboardView(req);
  const { entries, cached } = await getLeaderboardCached(view);
  return NextResponse.json(
    { entries, cached, view },
    { headers: { "Cache-Control": CDN_CACHE } },
  );
}
