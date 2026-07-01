import "./_env.mjs";
import { collect } from "../src/lib/github";
import { score, spamBotScore, tierFor } from "../src/lib/score";
import { recordScore, recordProfileSnapshot } from "../src/lib/db";
import type { ScanResult } from "../src/lib/types";

const users = process.argv.slice(2);
if (!users.length) { console.error("usage: ingest-devs.mts <user...>"); process.exit(1); }
const EMPTY = { zh: [] as string[], en: [] as string[] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

for (let i = 0; i < users.length; i++) {
  const u = users[i];
  if (i > 0) await sleep(2000);
  try {
    const collected = await collect(u);
    const scoring = score(collected.metrics);
    const scan: ScanResult = { ...collected, scoring };
    const { tier } = tierFor(scoring.final_score);
    await recordScore({
      username: collected.metrics.username,
      display_name: collected.metrics.name,
      avatar_url: collected.metrics.avatar_url,
      profile_url: collected.metrics.profile_url,
      final_score: scoring.final_score,
      tier,
      tags: EMPTY,
      roast_line: { zh: "", en: "" },
      bot_score: spamBotScore(collected.metrics),
      sub_scores: scoring.sub_scores,
      scanned_at: Date.now(),
    });
    await recordProfileSnapshot(scan);
    const orgs = collected.organizations ?? [];
    const hasLg = orgs.some((o) => o.toLowerCase() === "langgenius");
    console.log(`OK  ${collected.metrics.username.padEnd(16)} score=${String(scoring.final_score).padStart(5)} ${tier.padEnd(6)} langgenius=${hasLg?"YES":"no "} orgs=[${orgs.join(",")}]`);
  } catch (e) {
    console.log(`ERR ${u.padEnd(16)} ${e instanceof Error ? e.message : String(e)}`);
  }
}
