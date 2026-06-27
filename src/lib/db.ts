/**
 * Turso (libSQL) persistence for the leaderboard + percentile.
 *
 * Optional, like {@link ./redis}: if `TURSO_DATABASE_URL` is unset, every function
 * no-ops (returns null/empty) so the app runs fine without it. Stores exactly one
 * row per scanned account (latest score). The score itself is still computed
 * deterministically by `lib/score.ts`; this layer only persists the result for
 * cross-account ranking.
 */

import { Client, createClient } from "@libsql/client";
import type { Tier } from "./types";

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

function getClient(): Client | null {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return null;
  client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN, // omit for local file: URLs
  });
  return client;
}

/** Create the table/index once per process. */
function ensureSchema(db: Client): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.batch(
        [
          `CREATE TABLE IF NOT EXISTS scores (
             username     TEXT PRIMARY KEY,
             display_name TEXT,
             avatar_url   TEXT,
             profile_url  TEXT,
             final_score  REAL NOT NULL,
             tier         TEXT NOT NULL,
             hidden       INTEGER NOT NULL DEFAULT 0,
             scanned_at   INTEGER NOT NULL
           )`,
          `CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(final_score DESC)`,
        ],
        "write",
      );
    })().catch((e) => {
      schemaReady = null; // allow retry on next call
      throw e;
    });
  }
  return schemaReady;
}

export interface ScoreEntry {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  final_score: number;
  tier: Tier;
  scanned_at: number;
}

export interface LeaderboardEntry {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  final_score: number;
  tier: Tier;
}

/** Upsert an account's latest score. Best-effort; never throws to the caller. */
export async function recordScore(entry: ScoreEntry): Promise<void> {
  const db = getClient();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.execute({
      sql: `INSERT INTO scores
              (username, display_name, avatar_url, profile_url, final_score, tier, scanned_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
              display_name = excluded.display_name,
              avatar_url   = excluded.avatar_url,
              profile_url  = excluded.profile_url,
              final_score  = excluded.final_score,
              tier         = excluded.tier,
              scanned_at   = excluded.scanned_at`,
      args: [
        entry.username.toLowerCase(),
        entry.display_name,
        entry.avatar_url,
        entry.profile_url,
        entry.final_score,
        entry.tier,
        entry.scanned_at,
      ],
    });
  } catch (e) {
    console.error("recordScore failed:", e);
  }
}

/** Counts for percentile: accounts strictly below `score`, and the total. */
export async function getPercentile(
  score: number,
): Promise<{ below: number; total: number } | null> {
  const db = getClient();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const res = await db.execute({
      sql: `SELECT
              (SELECT COUNT(*) FROM scores WHERE final_score < ?) AS below,
              (SELECT COUNT(*) FROM scores) AS total`,
      args: [score],
    });
    const row = res.rows[0];
    if (!row) return null;
    return { below: Number(row.below), total: Number(row.total) };
  } catch (e) {
    console.error("getPercentile failed:", e);
    return null;
  }
}

/** Total number of accounts ever evaluated (for the "N developers" counter). */
export async function getScoreCount(): Promise<number | null> {
  const db = getClient();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const res = await db.execute("SELECT COUNT(*) AS n FROM scores");
    return Number(res.rows[0]?.n ?? 0);
  } catch (e) {
    console.error("getScoreCount failed:", e);
    return null;
  }
}

/** Top high-scoring accounts for the public 名人堂 board (excludes hidden). */
export async function getLeaderboard(
  limit = 100,
  minScore = 60,
): Promise<LeaderboardEntry[]> {
  const db = getClient();
  if (!db) return [];
  try {
    await ensureSchema(db);
    const res = await db.execute({
      sql: `SELECT username, display_name, avatar_url, profile_url, final_score, tier
            FROM scores
            WHERE hidden = 0 AND final_score >= ?
            ORDER BY final_score DESC, scanned_at DESC
            LIMIT ?`,
      args: [minScore, limit],
    });
    return res.rows.map((r) => ({
      username: String(r.username),
      display_name: r.display_name as string | null,
      avatar_url: r.avatar_url as string | null,
      profile_url: r.profile_url as string | null,
      final_score: Number(r.final_score),
      tier: String(r.tier) as Tier,
    }));
  } catch (e) {
    console.error("getLeaderboard failed:", e);
    return [];
  }
}

/** Remove an account from the public board (still counted in the percentile). */
export async function hideUser(username: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.execute({
      sql: `UPDATE scores SET hidden = 1 WHERE username = ?`,
      args: [username.toLowerCase()],
    });
  } catch (e) {
    console.error("hideUser failed:", e);
  }
}
