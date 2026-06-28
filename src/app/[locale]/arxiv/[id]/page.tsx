import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPaper, getPaperRoast } from "@/lib/db";
import { JsonLd, paperReviewJsonLd } from "@/components/JsonLd";
import { PAPER_DIM_KEYS, paperTierStyle } from "@/lib/paper-score";
import { normLang } from "@/lib/lang";
import { normPaperMode } from "@/lib/paper-types";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

const getDetail = cache((id: string) => getPaper(id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "paperMeta" });
  const tt = await getTranslations({ locale, namespace: "paperTiers" });
  const p = await getDetail(decodeURIComponent(id));
  if (!p) return { title: t("notFoundTitle") };
  const tier = tt(`${p.tier}.name`);
  const tldr = normLang(locale) === "en" ? p.tldr_line.en : p.tldr_line.zh;
  const title = t("detailTitle", { title: p.title, score: p.final_score.toFixed(2), tier });
  const image = `/api/paper-card/${p.arxiv_id}`;
  const path = locale === "en" ? `/en/arxiv/${p.arxiv_id}` : `/arxiv/${p.arxiv_id}`;
  return {
    title,
    description: tldr || t("description"),
    alternates: { languages: { "zh-CN": `/arxiv/${p.arxiv_id}`, en: `/en/arxiv/${p.arxiv_id}` } },
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
  const p = await getDetail(decodeURIComponent(id));
  if (!p) notFound();

  const t = await getTranslations("paper");
  const tTier = await getTranslations("paperTiers");
  const lang = normLang(locale);
  const mode = normPaperMode((await searchParams)?.mode);
  const style = paperTierStyle(p.tier);
  const tldr = lang === "en" ? p.tldr_line.en : p.tldr_line.zh;
  const report = await getPaperRoast(p.arxiv_id, mode, lang);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-14 sm:py-20">
      <JsonLd
        data={paperReviewJsonLd({
          arxivId: p.arxiv_id,
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
        className={`animate-pop mt-4 flex flex-col items-center rounded-2xl border bg-white/[0.03] p-6 text-center ring-1 ${style.ring}`}
        style={{ boxShadow: `0 0 80px -20px ${style.glow}` }}
      >
        <a
          href={`https://arxiv.org/abs/${p.arxiv_id}`}
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
          {style.emoji} {tTier(`${p.tier}.name`)}
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
              href={`/arxiv/${p.arxiv_id}`}
              className={`rounded-full px-2.5 py-1 ${mode === "roast" ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"}`}
            >
              {t("modeRoast")}
            </Link>
            <Link
              href={`/arxiv/${p.arxiv_id}?mode=praise`}
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
                <Link href="/arxiv" className="text-orange-400 hover:underline">
                  {c}
                </Link>
              ),
            })}
          </p>
        )}
      </section>

      <footer className="mt-10 text-center">
        <Link
          href="/arxiv"
          className="inline-block rounded-full bg-orange-600 px-5 py-2 text-sm font-medium text-white hover:bg-orange-500"
        >
          {t("detailCta")}
        </Link>
        <div className="mt-3 text-xs text-zinc-600">
          <a href={`${SITE_URL}/arxiv/${p.arxiv_id}`} className="hover:text-zinc-400">
            {SITE_URL.replace(/^https?:\/\//, "")}/arxiv/{p.arxiv_id}
          </a>
        </div>
      </footer>
    </main>
  );
}
