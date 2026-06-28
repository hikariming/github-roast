/**
 * Paper scoring: "内容为主 + 引用加成".
 *
 * Content base (0–80) comes from the LLM rubric (5 dims, each 0–10) via weights.
 * Citation bonus (0–20) is deterministic from Semantic Scholar signals + venue.
 * final = clamp(content_base + citation_bonus, 0, 100). A fresh paper (no
 * citations) caps ~80 on merit; a landmark like Transformer gets the full bonus.
 */

import type { PaperData, PaperDimKey, PaperDims, PaperTierKey } from "./paper-types";

const DIM_WEIGHTS: Record<PaperDimKey, number> = {
  novelty: 0.25,
  rigor: 0.25,
  significance: 0.2,
  clarity: 0.15,
  reproducibility: 0.15,
};

const CONTENT_MAX = 80;
const CITATION_MAX = 20;

/** Top venues that earn the venue slice of the citation bonus. */
const TOP_VENUE_RE =
  /\b(neurips|nips|icml|iclr|cvpr|iccv|eccv|acl|emnlp|naacl|aaai|ijcai|kdd|sigir|siggraph|nature|science|cell|pnas|jmlr|tpami|osdi|sosp|usenix)\b/i;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Weighted content score (0–80) from the LLM's 0–10 per-dimension rubric. */
export function contentBase(dims: PaperDims): number {
  let sum = 0;
  for (const k of Object.keys(DIM_WEIGHTS) as PaperDimKey[]) {
    sum += DIM_WEIGHTS[k] * (clamp(dims[k] ?? 0, 0, 10) / 10);
  }
  return Math.round(sum * CONTENT_MAX * 100) / 100;
}

/** Deterministic recognition bonus (0–20) from citations + venue. */
export function citationBonus(paper: PaperData): number {
  const c = paper.citation_count ?? 0;
  const ic = paper.influential_citation_count ?? 0;
  // log10(1+c)/5 hits 1.0 at ~100k citations → 12 pts; Transformer maxes this.
  const cite = clamp((Math.log10(1 + c) / 5) * 12, 0, 12);
  const infl = clamp((Math.log10(1 + ic) / 3) * 4, 0, 4);
  const venue = paper.venue && TOP_VENUE_RE.test(paper.venue) ? 4 : 0;
  return Math.round(clamp(cite + infl + venue, 0, CITATION_MAX) * 100) / 100;
}

export function finalScore(dims: PaperDims, paper: PaperData): number {
  return Math.round(clamp(contentBase(dims) + citationBonus(paper), 0, 100) * 100) / 100;
}

export interface PaperTierStyle {
  key: PaperTierKey;
  emoji: string;
  /** Tailwind text color class. */
  text: string;
  /** Tailwind ring/border color class. */
  ring: string;
  /** Radial glow color (CSS). */
  glow: string;
}

export const PAPER_TIER_STYLES: Record<PaperTierKey, PaperTierStyle> = {
  masterpiece: { key: "masterpiece", emoji: "🏆", text: "text-amber-300", ring: "ring-amber-400/50", glow: "rgba(251,191,36,0.35)" },
  strong: { key: "strong", emoji: "🥇", text: "text-violet-300", ring: "ring-violet-400/50", glow: "rgba(167,139,250,0.30)" },
  solid: { key: "solid", emoji: "📘", text: "text-emerald-300", ring: "ring-emerald-400/50", glow: "rgba(52,211,153,0.30)" },
  mediocre: { key: "mediocre", emoji: "🫥", text: "text-slate-300", ring: "ring-slate-400/40", glow: "rgba(148,163,184,0.25)" },
  water: { key: "water", emoji: "💧", text: "text-rose-400", ring: "ring-rose-500/50", glow: "rgba(244,63,94,0.30)" },
};

export function paperTierFor(score: number): PaperTierKey {
  if (score >= 90) return "masterpiece";
  if (score >= 80) return "strong";
  if (score >= 65) return "solid";
  if (score >= 45) return "mediocre";
  return "water";
}

export function paperTierStyle(key: PaperTierKey): PaperTierStyle {
  return PAPER_TIER_STYLES[key] ?? PAPER_TIER_STYLES.mediocre;
}

export const PAPER_DIM_KEYS: PaperDimKey[] = [
  "novelty",
  "rigor",
  "significance",
  "clarity",
  "reproducibility",
];
