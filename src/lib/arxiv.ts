/**
 * arXiv + Semantic Scholar fetch layer — the paper equivalent of GitHub's
 * `collect()`. Pulls objective paper data ("scan") that the LLM rubric and the
 * citation-bonus score build on. No external SDK: arXiv returns Atom XML (parsed
 * with light regex over the single-entry feed) and Semantic Scholar returns JSON.
 */

import type { PaperData } from "./paper-types";

const ARXIV_API = "http://export.arxiv.org/api/query";
const S2_API = "https://api.semanticscholar.org/graph/v1/paper";

export class PaperNotFoundError extends Error {}

/**
 * Extract a canonical arXiv id (no version) from a raw id or any arXiv URL.
 * Handles new-style `1706.03762`, old-style `cs/0309136`, `arXiv:` prefixes,
 * `/abs/`, `/pdf/`, and trailing `vN`. Returns null if nothing looks like an id.
 */
export function normalizeArxivId(input: string): string | null {
  const s = input.trim();
  const newStyle = s.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  if (newStyle) return newStyle[1];
  const oldStyle = s.match(/([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?/i);
  if (oldStyle) return oldStyle[1];
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1].replace(/\s+/g, " ").trim()) : null;
}

/** Fetch + parse the arXiv Atom entry. Throws PaperNotFoundError if absent. */
async function fetchArxivMeta(id: string): Promise<Omit<PaperData, "citation_count" | "influential_citation_count" | "venue" | "tldr">> {
  const res = await fetch(`${ARXIV_API}?id_list=${encodeURIComponent(id)}&max_results=1`, {
    headers: { "User-Agent": "githubroast.dev paper-review" },
  });
  if (!res.ok) throw new Error(`arXiv API ${res.status}`);
  const xml = await res.text();
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/i)?.[1];
  // arXiv returns a stub entry with no <id> for unknown ids.
  if (!entry || /arxiv.org\/api\/errors/.test(entry) || !tag(entry, "title")) {
    throw new PaperNotFoundError(id);
  }
  const authors = Array.from(entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/gi)).map((m) =>
    decodeEntities(m[1].trim()),
  );
  const categories = Array.from(entry.matchAll(/<category[^>]*term="([^"]+)"/gi)).map((m) => m[1]);
  return {
    arxiv_id: id,
    title: tag(entry, "title") ?? id,
    authors,
    abstract: tag(entry, "summary") ?? "",
    categories: Array.from(new Set(categories)),
    published: tag(entry, "published"),
  };
}

interface S2Response {
  citationCount?: number;
  influentialCitationCount?: number;
  venue?: string;
  tldr?: { text?: string } | null;
}

/** Best-effort citation signals from Semantic Scholar; all null on miss/error. */
async function fetchCitations(id: string): Promise<Pick<PaperData, "citation_count" | "influential_citation_count" | "venue" | "tldr">> {
  const empty = { citation_count: null, influential_citation_count: null, venue: null, tldr: null };
  try {
    const headers: Record<string, string> = {};
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    const res = await fetch(
      `${S2_API}/arXiv:${encodeURIComponent(id)}?fields=citationCount,influentialCitationCount,venue,tldr`,
      { headers },
    );
    if (!res.ok) return empty;
    const j = (await res.json()) as S2Response;
    return {
      citation_count: typeof j.citationCount === "number" ? j.citationCount : null,
      influential_citation_count:
        typeof j.influentialCitationCount === "number" ? j.influentialCitationCount : null,
      venue: j.venue || null,
      tldr: j.tldr?.text || null,
    };
  } catch {
    return empty;
  }
}

/** Full paper "scan": arXiv metadata + (best-effort) citation signals. */
export async function fetchPaper(id: string): Promise<PaperData> {
  const [meta, cites] = await Promise.all([fetchArxivMeta(id), fetchCitations(id)]);
  return { ...meta, ...cites };
}
