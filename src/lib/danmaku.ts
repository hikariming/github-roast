/**
 * AI-generated "弹幕" (bullet-screen comments) for the developer detail page.
 *
 * When a profile has fewer than {@link DANMAKU_MIN_DISPLAY} real visitor
 * comments, we top up the floating wall with a few short, fun, data-grounded
 * lines written by the LLM. They are always shown as **anonymous** — never
 * attributed to a real GitHub user.
 *
 * Each line is tagged with its own language and the wall shows a MIX of Chinese
 * and English to everyone (regardless of locale), so an English visitor never
 * faces an all-Chinese wall and the page feels like a global crowd reacting.
 * The lines are distinct per language (not translations of each other), each
 * written to sound native — internet-savvy, not translationese. Generated once
 * then persisted, so repeat views never re-spend LLM credit.
 */

/** One danmaku line in its own language; the wall renders all of them mixed. */
export interface DanmakuLine {
  lang: "zh" | "en";
  text: string;
}

/** Below this many real comments, supplement the wall with AI danmaku. */
export const DANMAKU_MIN_DISPLAY = 5;
/** How many lines to ask the model for, per language. */
export const DANMAKU_PER_LANG = 4;
/** Hard cap kept per language when sanitizing model output. */
export const DANMAKU_MAX_PER_LANG = 5;
/** Per-line hard length cap (characters). Generous enough that a ~12-word
 * English line is never truncated mid-word, while CJK lines stay well under it. */
export const DANMAKU_MAX_LEN = 90;

/** Compact context the danmaku prompt is built from (assembled from the
 * persisted score + profile snapshot, so generation needs no live crawl). */
export interface DanmakuContext {
  username: string;
  displayName: string | null;
  finalScore: number;
  tier: string;
  tierLabel: string;
  tags: string[];
  topRepos: { name: string; stars: number; language: string | null }[];
  impactRepos: { repo: string; stars: number }[];
  languages: string[];
  topics: string[];
  bio: string | null;
}

function cleanLine(input: unknown): string {
  if (typeof input !== "string") return "";
  // Collapse whitespace, drop @mentions/# so a line never reads as a real
  // handle or hashtag, and cap length.
  const compact = input.replace(/\s+/g, " ").trim().replace(/^[@#]+/, "").trim();
  return Array.from(compact).slice(0, DANMAKU_MAX_LEN).join("");
}

/**
 * Coerce raw LLM output into clean per-language lines. Accepts an array of
 * `{lang, text}` objects (lang inferred from CJK content when missing). Drops
 * empties, dedupes, and caps each language to {@link DANMAKU_MAX_PER_LANG}.
 */
export function normalizeDanmakuLines(raw: unknown): DanmakuLine[] {
  if (!Array.isArray(raw)) return [];
  const out: DanmakuLine[] = [];
  const seen = new Set<string>();
  let zhCount = 0;
  let enCount = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const text = cleanLine(obj.text ?? obj.zh ?? obj.en);
    if (!text) continue;
    const lang: "zh" | "en" =
      obj.lang === "en" ? "en" : obj.lang === "zh" ? "zh" : /[一-鿿]/.test(text) ? "zh" : "en";
    const key = `${lang}:${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    if (lang === "zh" && zhCount >= DANMAKU_MAX_PER_LANG) continue;
    if (lang === "en" && enCount >= DANMAKU_MAX_PER_LANG) continue;
    seen.add(key);
    if (lang === "zh") zhCount++;
    else enCount++;
    out.push({ lang, text });
  }
  return out;
}

/** Interleave zh/en lines (zh, en, zh, en, …) so the rendered wall stays mixed
 * rather than clumping one language together. */
export function interleaveDanmakuByLang(lines: DanmakuLine[]): DanmakuLine[] {
  const zh = lines.filter((l) => l.lang === "zh");
  const en = lines.filter((l) => l.lang === "en");
  const out: DanmakuLine[] = [];
  for (let i = 0; i < Math.max(zh.length, en.length); i++) {
    if (zh[i]) out.push(zh[i]);
    if (en[i]) out.push(en[i]);
  }
  return out;
}
