import "/Users/rqq/github-roast/scripts/_env.mjs";
import { collect } from "/Users/rqq/github-roast/src/lib/github.ts";
import { score, spamBotScore, tierFor } from "/Users/rqq/github-roast/src/lib/score.ts";
import {
  recordScore,
  recordProfileSnapshot,
  updateRoast,
} from "/Users/rqq/github-roast/src/lib/db.ts";
import { setCachedScan, setCachedRoast, scanKey, roastKey } from "/Users/rqq/github-roast/src/lib/redis.ts";
import type { ScanResult } from "/Users/rqq/github-roast/src/lib/types.ts";
import {
  buildCtx,
  buildTags,
  buildRoastLine,
  buildRoastReport,
} from "/Users/rqq/github-roast/scripts/roast-gen.mts";
import { createClient } from "@libsql/client";

const USER = process.argv[2] || "dae";
const WRITE = process.argv.includes("--write"); // dry-run unless --write

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// --- before snapshot from DB ---
const before = await db.execute({
  sql: `SELECT final_score, tier, score_version FROM scores WHERE username=?`,
  args: [USER.toLowerCase()],
});
console.log("BEFORE (db):", JSON.stringify(before.rows[0] ?? null));

// --- re-collect + re-score with current (latest) code ---
const collected = await collect(USER);
const scoring = score(collected.metrics);
const scan: ScanResult = { ...collected, scoring };
const { tier } = tierFor(scoring.final_score);

console.log("AFTER (recomputed):", JSON.stringify({
  username: collected.metrics.username,
  final_score: scoring.final_score,
  tier,
  sub_scores: scoring.sub_scores,
}, null, 2));

// --- build deterministic roast artifacts (same as mega-ingest) ---
const realOrgs = collected.organizations ?? [];
const orgDisplay = realOrgs[0] ?? "";
const ctx = buildCtx({
  username: collected.metrics.username,
  displayName: collected.metrics.name,
  m: collected.metrics,
  scoring,
  topRepos: collected.top_repos ?? [],
  impactRepos: collected.impact_repos ?? [],
  orgs: realOrgs,
  orgDisplay,
});
const tags = buildTags(ctx);
const roastLine = buildRoastLine(ctx);
const reportZh = buildRoastReport(ctx, "zh");
const reportEn = buildRoastReport(ctx, "en");

console.log("roast_line:", JSON.stringify(roastLine));
console.log("tags:", JSON.stringify(tags));

if (!WRITE) {
  console.log("\n[DRY RUN] pass --write to persist to DB + Redis. Nothing written.");
  process.exit(0);
}

// --- persist to DB (mirror mega-ingest) ---
await recordScore({
  username: collected.metrics.username,
  display_name: collected.metrics.name,
  avatar_url: collected.metrics.avatar_url,
  profile_url: collected.metrics.profile_url,
  final_score: scoring.final_score,
  tier,
  tags,
  roast_line: roastLine,
  bot_score: spamBotScore(collected.metrics),
  sub_scores: scoring.sub_scores,
  scanned_at: Date.now(),
});
await recordProfileSnapshot(scan);
await updateRoast(collected.metrics.username, reportZh, "zh");
await updateRoast(collected.metrics.username, reportEn, "en");
console.log("DB: recordScore + snapshot + roast(zh,en) written.");

// --- populate online cache (scan:v6 + roast:v8 zh/en) ---
await setCachedScan(collected.metrics.username, scan);
for (const [lang, report] of [["zh", reportZh], ["en", reportEn]] as const) {
  await setCachedRoast(collected.metrics.username, lang, {
    report,
    delta: 0, // deterministic path: no LLM score adjustment
    tags,
    roast_line: roastLine,
    final_score: scoring.final_score,
    tier,
  });
}
console.log("REDIS: set", scanKey(collected.metrics.username), "+",
  roastKey(collected.metrics.username, "zh"), "+", roastKey(collected.metrics.username, "en"));

// --- verify readback ---
const after = await db.execute({
  sql: `SELECT final_score, tier, score_version FROM scores WHERE username=?`,
  args: [collected.metrics.username.toLowerCase()],
});
console.log("AFTER (db readback):", JSON.stringify(after.rows[0] ?? null));
process.exit(0);
