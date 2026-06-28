/**
 * Types for the arXiv 锐评 (paper review) feature — a surface parallel to the
 * GitHub roast. A paper is fetched ("scan"), strictly scored (content rubric +
 * citation bonus), then commented on in one of two tones (roast / praise).
 */

import type { RoastLine, Tags } from "./types";

/** Commentary tone — does NOT affect the score, only the narrative. */
export type PaperMode = "roast" | "praise";

export function normPaperMode(v: unknown): PaperMode {
  return v === "praise" ? "praise" : "roast";
}

/** Objective paper data from arXiv + Semantic Scholar (the "scan" result). */
export interface PaperData {
  /** Canonical arXiv id without version, e.g. "1706.03762". */
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  /** arXiv primary categories, e.g. ["cs.CL", "cs.LG"]. */
  categories: string[];
  /** ISO date string of the first arXiv submission. */
  published: string | null;
  /** Semantic Scholar signals — null when the paper isn't found there. */
  citation_count: number | null;
  influential_citation_count: number | null;
  venue: string | null;
  /** Semantic Scholar TLDR, if available (else null). */
  tldr: string | null;
}

/** The five content rubric dimensions, each scored 0–10 by the LLM. */
export type PaperDimKey =
  | "novelty"
  | "rigor"
  | "significance"
  | "clarity"
  | "reproducibility";

export type PaperDims = Record<PaperDimKey, number>;

/** Stable, language-neutral slug per paper tier (i18n key under `paperTiers`). */
export type PaperTierKey = "masterpiece" | "strong" | "solid" | "mediocre" | "water";

/** Metadata emitted on the roast stream's `X-Paper-Meta` header. */
export interface PaperMeta {
  final_score: number;
  tier: PaperTierKey;
  dims: PaperDims;
  /** content portion (0–80) + citation bonus (0–20), for transparency. */
  content_base: number;
  citation_bonus: number;
  tags: Tags;
  tldr_line: RoastLine;
}
