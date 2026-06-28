import { NextRequest, NextResponse } from "next/server";
import { PaperNotFoundError, fetchPaper, normalizeArxivId } from "@/lib/arxiv";
import { checkRateLimit } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

/** Resolve an arXiv id/URL to objective paper data. No LLM, no persistence. */
export async function POST(req: NextRequest) {
  let body: { input?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const id = normalizeArxivId(body.input ?? "");
  if (!id) return NextResponse.json({ error: "invalid_arxiv" }, { status: 400 });

  const { success } = await checkRateLimit(clientIp(req));
  if (!success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  try {
    const paper = await fetchPaper(id);
    return NextResponse.json(paper);
  } catch (e) {
    if (e instanceof PaperNotFoundError) {
      return NextResponse.json({ error: "paper_not_found" }, { status: 404 });
    }
    console.error("paper scan failed:", e);
    return NextResponse.json({ error: "scan_failed" }, { status: 502 });
  }
}
