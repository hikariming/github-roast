import { NextRequest, NextResponse } from "next/server";
import { getPercentile, recordScore } from "@/lib/db";
import { LlmConfig, LlmQuotaError, chatStream, defaultLlmConfig } from "@/lib/llm";
import { beatPercent } from "@/lib/percentile";
import { buildRoastMessages } from "@/lib/prompt";
import {
  checkRoastRateLimit,
  getCachedRoast,
  getCachedScan,
  setCachedRoast,
} from "@/lib/redis";
import { clampScore, tierFor } from "@/lib/score";
import type { RoastMeta, ScanResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Response header carrying the AI-adjusted score (base64'd JSON; it contains CJK). */
export const ROAST_META_HEADER = "X-Roast-Meta";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

interface ByoKey {
  baseURL?: string;
  apiKey?: string;
  model?: string;
}

interface RoastBody {
  scan?: ScanResult;
  byoKey?: ByoKey;
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

function resolveConfig(byo?: ByoKey): { config: LlmConfig; isDefault: boolean } | null {
  if (byo?.apiKey && byo.baseURL && byo.model) {
    return { config: { baseURL: byo.baseURL, apiKey: byo.apiKey, model: byo.model }, isDefault: false };
  }
  const config = defaultLlmConfig();
  return config ? { config, isDefault: true } : null;
}

/** Parse `@@ADJUST <int>@@` from the model's leading line; clamp to [-10, 10]. */
function parseDelta(head: string): number {
  const m = head.match(/@@ADJUST\s*([+-]?\d+(?:\.\d+)?)\s*@@/);
  if (!m) return 0;
  const n = Math.round(parseFloat(m[1]));
  if (!Number.isFinite(n)) return 0;
  return Math.max(-10, Math.min(10, n));
}

/** Bound a client-supplied scan so a fabricated payload can't bloat the prompt. */
function sanitizeScan(scan: ScanResult): ScanResult {
  return {
    metrics: scan.metrics,
    top_repos: (scan.top_repos ?? []).slice(0, 10).map((r) => ({
      ...r,
      description: r.description?.slice(0, 300) ?? null,
      readme_excerpt: r.readme_excerpt?.slice(0, 500) ?? null,
    })),
    recent_prs: (scan.recent_prs ?? []).slice(0, 20).map((p) => ({
      ...p,
      title: p.title?.slice(0, 200) ?? null,
    })),
    flood_pr_titles: (scan.flood_pr_titles ?? []).slice(0, 5).map((t) => t.slice(0, 200)),
    scoring: scan.scoring,
  };
}

function metaHeader(meta: RoastMeta): string {
  return Buffer.from(JSON.stringify(meta), "utf-8").toString("base64");
}

function roastResponse(body: ReadableStream<Uint8Array> | string, meta: RoastMeta): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      [ROAST_META_HEADER]: metaHeader(meta),
    },
  });
}

/** Adjusted score + tier + fresh percentile. Records to the leaderboard only on a
 * fresh (non-replayed) default-model roast. */
async function computeMeta(
  scan: ScanResult,
  delta: number,
  record: boolean,
): Promise<RoastMeta> {
  const adjusted = clampScore(scan.scoring.final_score + delta);
  const { tier, tier_label } = tierFor(adjusted);
  if (record) {
    await recordScore({
      username: scan.metrics.username,
      display_name: scan.metrics.name,
      avatar_url: scan.metrics.avatar_url,
      profile_url: scan.metrics.profile_url,
      final_score: adjusted,
      tier,
      scanned_at: Date.now(),
    });
  }
  const counts = await getPercentile(adjusted);
  const percentile = counts
    ? { beat: beatPercent(counts.below, counts.total), total: counts.total }
    : null;
  return { final_score: adjusted, tier, tier_label, delta, percentile };
}

export async function POST(req: NextRequest) {
  let body: RoastBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const username = body.scan?.metrics?.username;
  if (!username || !USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "missing_scan" }, { status: 400 });
  }

  const resolved = resolveConfig(body.byoKey);
  if (!resolved) {
    return NextResponse.json({ error: "no_llm_configured", useByoKey: true }, { status: 400 });
  }
  const { config, isDefault } = resolved;

  // Prefer the server's cached scan (authoritative — the client cannot fabricate
  // metrics to inflate the prompt or the score). Fall back to the sanitized
  // client scan when there is no cache (e.g. Redis unconfigured).
  const cachedScan = await getCachedScan(username);
  const scan = cachedScan ?? (body.scan ? sanitizeScan(body.scan) : null);
  if (!scan?.metrics || !scan.scoring) {
    return NextResponse.json({ error: "missing_scan" }, { status: 400 });
  }

  // Default-model protections: serve a cached roast for free, else rate-limit the
  // (credit-spending) LLM call. BYO keys skip both — it's the user's own credit.
  if (isDefault) {
    const cachedRoast = await getCachedRoast(username);
    if (cachedRoast) {
      const meta = await computeMeta(scan, cachedRoast.delta, false);
      return roastResponse(cachedRoast.report, meta);
    }
    const { success } = await checkRoastRateLimit(clientIp(req));
    if (!success) {
      return NextResponse.json(
        { error: "rate_limited", useByoKey: true },
        { status: 429 },
      );
    }
  }

  const generator = chatStream(config, buildRoastMessages(scan));

  // Read the leading control line (`@@ADJUST n@@`) before streaming the report.
  // Pulling tokens up-front also surfaces quota/auth failures as a JSON status.
  let head = "";
  try {
    while (!head.includes("\n") && head.length < 2000) {
      const { done, value } = await generator.next();
      if (done) break;
      head += value;
    }
  } catch (e) {
    if (e instanceof LlmQuotaError) {
      return NextResponse.json(
        { error: "llm_quota", useByoKey: true, status: e.status },
        { status: 402 },
      );
    }
    console.error("roast failed:", e);
    return NextResponse.json({ error: "roast_failed" }, { status: 502 });
  }

  const delta = parseDelta(head);
  let report = head;
  const newlineAt = head.indexOf("\n");
  if (/@@ADJUST/.test(head) && newlineAt >= 0) {
    report = head.slice(newlineAt + 1);
  }

  const meta = await computeMeta(scan, delta, isDefault);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = report;
      try {
        if (report) controller.enqueue(encoder.encode(report));
        for await (const chunk of generator) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        // Cache the finished roast so repeat views don't re-spend LLM credit.
        if (isDefault) await setCachedRoast(username, { report: full, delta });
      } catch (e) {
        console.error("roast stream error:", e);
      } finally {
        controller.close();
      }
    },
  });

  return roastResponse(stream, meta);
}
