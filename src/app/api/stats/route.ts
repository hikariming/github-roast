import { NextResponse } from "next/server";
import { getScoreCount } from "@/lib/db";
import { getCachedStats, setCachedStats } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cached = await getCachedStats();
  if (cached !== null) {
    return NextResponse.json({ total: cached, cached: true });
  }
  const total = await getScoreCount();
  if (total !== null) await setCachedStats(total);
  return NextResponse.json({ total, cached: false });
}
