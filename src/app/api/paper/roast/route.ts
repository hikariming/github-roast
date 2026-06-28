import { NextRequest, NextResponse } from "next/server";
import { normLang } from "@/lib/lang";
import { LlmConfig, LlmQuotaError, chatStream, defaultLlmConfig } from "@/lib/llm";
import { buildPaperMessages } from "@/lib/paper-prompt";
import { checkRoastRateLimit } from "@/lib/redis";
import { citationBonus, contentBase, finalScore, paperTierFor } from "@/lib/paper-score";
import { normPaperMode } from "@/lib/paper-types";
import type { PaperData, PaperDimKey, PaperDims, PaperMeta } from "@/lib/paper-types";
import type { RoastLine, Tags } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PAPER_META_HEADER = "X-Paper-Meta";
// Lower temperature than the playful GitHub roast — the score must be stable.
const PAPER_TEMPERATURE = 0.4;

interface ByoKey {
  baseURL?: string;
  apiKey?: string;
  model?: string;
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

const DIM_KEYS: PaperDimKey[] = ["novelty", "rigor", "significance", "clarity", "reproducibility"];

function parseScores(head: string): PaperDims {
  const body = head.match(/@@SCORES\s*([^@]*?)@@/)?.[1] ?? "";
  const dims = {} as PaperDims;
  for (const k of DIM_KEYS) {
    const m = body.match(new RegExp(`${k}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)`, "i"));
    dims[k] = m ? Math.max(0, Math.min(10, parseFloat(m[1]))) : 5;
  }
  return dims;
}

function parseTldr(head: string): RoastLine {
  const body = head.match(/@@TLDR\s*([\s\S]*?)@@/)?.[1] ?? "";
  const grab = (key: string): string => {
    const m = body.match(new RegExp(`${key}=([\\s\\S]*?)(?=\\||$)`));
    return (m?.[1] ?? "").trim().slice(0, 200);
  };
  return { zh: grab("zh"), en: grab("en") };
}

function parseTags(head: string): Tags {
  const body = head.match(/@@TAGS\s*([^@]*?)@@/)?.[1] ?? "";
  const grab = (key: string): string[] => {
    const m = body.match(new RegExp(`${key}=([^|@]+)`));
    return m ? m[1].split(/[,，、]/).map((t) => t.trim()) : [];
  };
  const clean = (arr: string[], maxLen: number): string[] =>
    Array.from(new Set(arr.map((t) => t.replace(/[#@]/g, "").trim()).filter(Boolean).map((t) => t.slice(0, maxLen)))).slice(0, 5);
  return { zh: clean(grab("zh"), 12), en: clean(grab("en"), 24) };
}

function extractReport(head: string): string {
  const lines = head.split("\n");
  const idx = lines.findIndex((l) => /^\s*##\s/.test(l));
  if (idx >= 0) return lines.slice(idx).join("\n");
  return lines.filter((l) => !/@@(SCORES|TLDR|TAGS)/.test(l)).join("\n").replace(/^\n+/, "");
}

interface PaperRoastBody {
  paper?: PaperData;
  mode?: string;
  lang?: string;
  byoKey?: ByoKey;
  /** Tone-switch path: reuse a previously computed score so it stays stable. */
  locked?: { score: number; dims: PaperDims };
}

export async function POST(req: NextRequest) {
  let body: PaperRoastBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const paper = body.paper;
  if (!paper?.arxiv_id || !paper.title) {
    return NextResponse.json({ error: "missing_paper" }, { status: 400 });
  }
  const mode = normPaperMode(body.mode);
  const lang = normLang(body.lang);

  const resolved = resolveConfig(body.byoKey);
  if (!resolved) {
    return NextResponse.json({ error: "no_llm_configured", useByoKey: true }, { status: 400 });
  }
  const { config, isDefault } = resolved;

  if (isDefault) {
    const { success } = await checkRoastRateLimit(clientIp(req));
    if (!success) {
      return NextResponse.json({ error: "rate_limited", useByoKey: true }, { status: 429 });
    }
  }

  const generator = chatStream(
    config,
    buildPaperMessages({ paper, mode, lang, locked: body.locked }),
    { temperature: PAPER_TEMPERATURE },
  );

  let head = "";
  try {
    while (!/(^|\n)\s*##\s/.test(head) && head.length < 2000) {
      const { done, value } = await generator.next();
      if (done) break;
      head += value;
    }
  } catch (e) {
    if (e instanceof LlmQuotaError) {
      return NextResponse.json({ error: "llm_quota", useByoKey: true, status: e.status }, { status: 402 });
    }
    console.error("paper roast failed:", e);
    return NextResponse.json({ error: "roast_failed" }, { status: 502 });
  }

  const tags = parseTags(head);
  const tldr_line = parseTldr(head);
  const report = extractReport(head);

  // Locked (tone switch): reuse the fixed score. Else compute from the rubric.
  let dims: PaperDims;
  let content_base: number;
  let citation_bonus: number;
  let final: number;
  if (body.locked) {
    dims = body.locked.dims;
    content_base = contentBase(dims);
    citation_bonus = Math.round((body.locked.score - content_base) * 100) / 100;
    final = body.locked.score;
  } else {
    dims = parseScores(head);
    content_base = contentBase(dims);
    citation_bonus = citationBonus(paper);
    final = finalScore(dims, paper);
  }
  const meta: PaperMeta = {
    final_score: final,
    tier: paperTierFor(final),
    dims,
    content_base,
    citation_bonus,
    tags,
    tldr_line,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (b: Uint8Array) => {
        try {
          controller.enqueue(b);
        } catch {
          /* client gone */
        }
      };
      try {
        if (report) push(encoder.encode(report));
        for await (const chunk of generator) push(encoder.encode(chunk));
      } catch (e) {
        console.error("paper roast stream error:", e);
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      [PAPER_META_HEADER]: Buffer.from(JSON.stringify(meta), "utf-8").toString("base64"),
    },
  });
}
