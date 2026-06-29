import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPaper, getPaperRoast } from "@/lib/db";
import type { PaperDetail } from "@/lib/db";
import { fetchPaper, normalizeArxivId } from "@/lib/arxiv";
import type { PaperData } from "@/lib/paper-types";
import { JsonLd, paperReviewJsonLd } from "@/components/JsonLd";
import { PaperShare } from "@/components/PaperShare";
import { PAPER_DIM_KEYS, paperTierStyle } from "@/lib/paper-score";
import { normLang } from "@/lib/lang";
import { normPaperMode } from "@/lib/paper-types";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

type Loaded =
  | { kind: "scored"; paper: PaperDetail }
  | { kind: "teaser"; paper: PaperData }
  | null;

// Dedupe between generateMetadata() and the render. Falls back to a no-LLM arXiv
// fetch (teaser) so a real paper that hasn't been roasted yet never 404s — and
// only LLM scoring happens on the dedicated /arxiv tool (no LLM-on-GET abuse).
const load = cache(async (rawId: string): Promise<Loaded> => {
  const id = normalizeArxivId(rawId) ?? rawId;
  const scored = await getPaper(id);
  if (scored) return { kind: "scored", paper: scored };
  const meta = await fetchPaper(id).catch(() => null);
  return meta ? { kind: "teaser", paper: meta } : null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "paperMeta" });
  const tt = await getTranslations({ locale, namespace: "paperTiers" });
  const loaded = await load(decodeURIComponent(id));
  if (!loaded) return { title: t("notFoundTitle") };
  const image = `/api/paper-card/${loaded.paper.arxiv_id}`;
  const path =
    locale === "en" ? `/en/arxiv/${loaded.paper.arxiv_id}` : `/arxiv/${loaded.paper.arxiv_id}`;
  const alternates = {
    languages: {
      "zh-CN": `/arxiv/${loaded.paper.arxiv_id}`,
      en: `/en/arxiv/${loaded.paper.arxiv_id}`,
    },
  };
  if (loaded.kind === "teaser") {
    const title = t("teaserTitle", { title: loaded.paper.title });
    return {
      title,
      description: loaded.paper.abstract.slice(0, 160) || t("description"),
      alternates,
      openGraph: { title, description: t("description"), url: path, type: "article", images: [image] },
      twitter: { card: "summary_large_image", title, images: [image] },
    };
  }
  const p = loaded.paper;
  const tier = tt(`${p.tier}.name`);
  const tldr = normLang(locale) === "en" ? p.tldr_line.en : p.tldr_line.zh;
  const title = t("detailTitle", { title: p.title, score: p.final_score.toFixed(2), tier });
  return {
    title,
    description: tldr || t("description"),
    alternates,
    openGraph: {
      title,
      description: tldr || t("description"),
      url: path,
      type: "article",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description: tldr, images: [image] },
  };
}

export default async function PaperDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const loaded = await load(decodeURIComponent(id));
  if (!loaded) notFound();

  const t = await getTranslations("paper");
  const tTier = await getTranslations("paperTiers");
  const lang = normLang(locale);
  const arxivId = loaded.paper.arxiv_id;
  const shareLink = `${SITE_URL}${locale === "en" ? `/en/arxiv/${arxivId}` : `/arxiv/${arxivId}`}`;
  const cardUrl = `${SITE_URL}/api/paper-card/${arxivId}`;

  // ── Teaser: real paper, not roasted yet — drive to the tool, never 404. ──
  if (loaded.kind === "teaser") {
    const p = loaded.paper;
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-14 sm:py-20">
        <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <a
            href={`https://arxiv.org/abs/${arxivId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-balance text-lg font-bold leading-snug text-zinc-100 hover:text-white"
          >
            {p.title}
          </a>
          <div className="mt-1 max-w-full truncate text-xs text-zinc-500">
            {p.authors.slice(0, 4).join(", ")}
            {p.authors.length > 4 ? " et al." : ""}
          </div>
          <div className="mt-5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-200">
            {t("teaserPending")}
          </div>
          {p.abstract && (
            <p className="mt-4 line-clamp-5 text-left text-sm leading-relaxed text-zinc-400">
              {p.abstract}
            </p>
          )}
          <Link
            href={`/arxiv?id=${arxivId}`}
            className="mt-6 inline-block rounded-full bg-orange-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-500"
          >
            {t("teaserCta")}
          </Link>
          <div className="mt-4">
            <PaperShare link={shareLink} text={t("shareTeaser", { title: p.title })} cardUrl={cardUrl} />
          </div>
        </div>
      </main>
    );
  }

  // ── Scored review ──
  const p = loaded.paper;
  const mode = normPaperMode((await searchParams)?.mode);
  const style = paperTierStyle(p.tier);
  const tldr = lang === "en" ? p.tldr_line.en : p.tldr_line.zh;
  const tierName = tTier(`${p.tier}.name`);
  const report = await getPaperRoast(arxivId, mode, lang);
  const shareText = t("shareScored", { title: p.title, score: p.final_score.toFixed(1), tier: tierName });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-14 sm:py-20">
      <JsonLd
        data={paperReviewJsonLd({
          arxivId,
          title: p.title,
          authors: p.authors,
          score: p.final_score,
          tldr: tldr || "",
          locale,
        })}
      />
      <Link href="/arxiv/leaderboard" className="text-sm text-zinc-400 hover:text-zinc-200">
        {t("backToBoard")}
      </Link>

      {/* Score card */}
      <div
        className={`animate-pop mt-4 flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center ring-1 ${style.ring}`}
        style={{ boxShadow: `0 0 80px -20px ${style.glow}` }}
      >
        <a
          href={`https://arxiv.org/abs/${arxivId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-full text-balance text-lg font-bold leading-snug text-zinc-100 hover:text-white"
        >
          {p.title}
        </a>
        <div className="mt-1 max-w-full truncate text-xs text-zinc-500">
          {p.authors.slice(0, 4).join(", ")}
          {p.authors.length > 4 ? " et al." : ""}
        </div>
        <div className={`mt-5 text-6xl font-black tabular-nums ${style.text}`}>
          {p.final_score.toFixed(2)}
          <span className="text-2xl text-zinc-600">/100</span>
        </div>
        <div className={`mt-1 text-2xl font-bold ${style.text}`}>
          {style.emoji} {tierName}
        </div>
        <div className="mt-1 text-sm text-zinc-400">{tTier(`${p.tier}.blurb`)}</div>
        <div className="mt-1 text-xs text-zinc-500">
          {t("contentScore")} {p.content_base.toFixed(1)} · {t("citationBonus")} +
          {p.citation_bonus.toFixed(1)} ·{" "}
          {p.citation_count !== null ? t("citations", { n: p.citation_count }) : t("noCitations")}
        </div>
        {tldr && (
          <p className="mt-4 w-full rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-3 text-left text-sm leading-relaxed text-zinc-100">
            💡 {tldr}
          </p>
        )}
        {(p.tags.zh.length > 0 || p.tags.en.length > 0) && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {[...p.tags.zh, ...p.tags.en].map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-200"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <PaperShare link={shareLink} text={shareText} cardUrl={cardUrl} />
          <Link
            href="/arxiv"
            className="rounded-full bg-orange-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-orange-500"
          >
            {t("detailCta")}
          </Link>
        </div>
      </div>

      {/* Dimensions */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <h2 className="mb-4 text-base font-bold text-zinc-200">{t("dimsHeading")}</h2>
        <div className="flex flex-col gap-3">
          {PAPER_DIM_KEYS.map((key) => {
            const v = p.dims[key] ?? 0;
            const pct = Math.max(0, Math.min(1, v / 10));
            return (
              <div key={key}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-zinc-300">{t(`dim_${key}`)}</span>
                  <span className="tabular-nums text-zinc-400">
                    {v.toFixed(1)}
                    <span className="text-zinc-600"> / 10</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${pct >= 0.75 ? "bg-emerald-400" : pct >= 0.45 ? "bg-amber-400" : "bg-rose-400"}`}
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Commentary + tone toggle */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-orange-400">
            {mode === "roast" ? t("commentaryRoast") : t("commentaryPraise")}
          </h2>
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs font-bold">
            <Link
              href={`/arxiv/${arxivId}`}
              className={`rounded-full px-2.5 py-1 ${mode === "roast" ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"}`}
            >
              {t("modeRoast")}
            </Link>
            <Link
              href={`/arxiv/${arxivId}?mode=praise`}
              className={`rounded-full px-2.5 py-1 ${mode === "praise" ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"}`}
            >
              {t("modePraise")}
            </Link>
          </div>
        </div>
        {report ? (
          <div className="report text-[0.95rem] text-zinc-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            {t.rich("detailNoMode", {
              a: (c) => (
                <Link href={`/arxiv?id=${arxivId}`} className="text-orange-400 hover:underline">
                  {c}
                </Link>
              ),
            })}
          </p>
        )}
      </section>
    </main>
  );
}
