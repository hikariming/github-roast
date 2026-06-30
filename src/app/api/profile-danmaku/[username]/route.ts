import { NextRequest, NextResponse } from "next/server";
import { normalizeGitHubUsername } from "@/lib/comments";
import {
  normalizeDanmakuLines,
  type DanmakuContext,
  type DanmakuLine,
} from "@/lib/danmaku";
import {
  getAccountDetail,
  getProfileDanmaku,
  getProfileSnapshot,
  saveProfileDanmaku,
} from "@/lib/db";
import { chatStream, defaultLlmConfig, LlmQuotaError } from "@/lib/llm";
import { aggregateLanguages, collectTopics } from "@/lib/profile-insights";
import { buildDanmakuMessages } from "@/lib/prompt";
import { checkRateLimit } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

interface DanmakuResponse {
  lines: DanmakuLine[];
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...init?.headers },
  });
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

/** Drain a chat stream into a single string, bounded so a runaway model can't
 * balloon memory; the danmaku JSON is tiny. */
async function readAll(gen: AsyncGenerator<string>, maxChars = 4000): Promise<string> {
  let text = "";
  for await (const chunk of gen) {
    text += chunk;
    if (text.length >= maxChars) break;
  }
  return text;
}

function parseLines(raw: string): DanmakuLine[] {
  const json = raw.match(/\[[\s\S]*\]/)?.[0];
  if (!json) return [];
  try {
    return normalizeDanmakuLines(JSON.parse(json));
  } catch {
    return [];
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ username: string }> },
) {
  const { username } = await ctx.params;
  const target = normalizeGitHubUsername(decodeURIComponent(username ?? ""));
  if (!target) {
    return jsonNoStore({ error: "invalid_username" }, { status: 400 });
  }

  // Persisted hit — free, and the common case after the first viewer.
  const cached = await getProfileDanmaku(target);
  if (cached.length > 0) {
    return jsonNoStore({ lines: cached } satisfies DanmakuResponse);
  }

  const config = defaultLlmConfig();
  if (!config) {
    return jsonNoStore({ lines: [] } satisfies DanmakuResponse);
  }

  // Generation spends LLM credit — rate-limit by IP (reuses the scan limiter).
  const { success } = await checkRateLimit(clientIp(req));
  if (!success) {
    return jsonNoStore({ error: "rate_limited", lines: [] }, { status: 429 });
  }

  const detail = await getAccountDetail(target);
  if (!detail) {
    return jsonNoStore({ lines: [] } satisfies DanmakuResponse, { status: 404 });
  }
  const snap = await getProfileSnapshot(target);

  const context: DanmakuContext = {
    username: detail.username,
    displayName: detail.display_name,
    finalScore: detail.final_score,
    tier: detail.tier,
    tierLabel: detail.tier,
    tags: [...new Set([...detail.tags.zh, ...detail.tags.en])],
    topRepos: (snap?.top_repos ?? [])
      .slice()
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 6)
      .map((r) => ({ name: r.name, stars: r.stars, language: r.language })),
    impactRepos: (snap?.impact_repos ?? [])
      .slice()
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 6)
      .map((r) => ({ repo: r.repo, stars: r.stars })),
    languages: snap ? aggregateLanguages(snap.top_repos).map((l) => l.name) : [],
    topics: snap ? collectTopics(snap.top_repos) : [],
    bio: snap?.bio ?? null,
  };

  let lines: DanmakuLine[];
  try {
    const raw = await readAll(chatStream(config, buildDanmakuMessages(context)));
    lines = parseLines(raw);
  } catch (e) {
    if (e instanceof LlmQuotaError) {
      return jsonNoStore({ error: "llm_quota", lines: [] }, { status: 402 });
    }
    console.error("danmaku generation failed:", e);
    return jsonNoStore({ error: "generation_failed", lines: [] }, { status: 502 });
  }

  if (lines.length === 0) {
    return jsonNoStore({ lines: [] } satisfies DanmakuResponse);
  }

  // Persist so repeat views never re-spend credit.
  await saveProfileDanmaku(target, lines);
  return jsonNoStore({ lines } satisfies DanmakuResponse);
}
