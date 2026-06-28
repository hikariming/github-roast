import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPaperLeaderboard } from "@/lib/db";
import { paperTierStyle } from "@/lib/paper-score";
import { normLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paperMeta" });
  return { title: t("boardTitle"), description: t("boardDescription") };
}

export default async function PaperBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  const view = (await searchParams)?.view === "bottom" ? "bottom" : "top";
  await connection();
  setRequestLocale(locale);
  const t = await getTranslations("paper");
  const lang = normLang(locale);
  const entries = await getPaperLeaderboard(view, 50);

  const tab = (key: "top" | "bottom", label: string) => (
    <Link
      href={key === "top" ? "/arxiv/leaderboard" : "/arxiv/leaderboard?view=bottom"}
      className={`rounded-full px-3 py-1.5 transition-colors ${
        view === key ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-14 sm:py-20">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-zinc-100 sm:text-4xl">
          {view === "top" ? t("boardTop") : t("boardBottom")}
        </h1>
        <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm font-bold">
          {tab("top", t("boardTop"))}
          {tab("bottom", t("boardBottom"))}
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="text-center text-zinc-500">{t("boardEmpty")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((p, i) => {
            const st = paperTierStyle(p.tier);
            const tag = lang === "en" ? p.tags.en[0] : p.tags.zh[0];
            return (
              <li key={p.arxiv_id}>
                <Link
                  href={`/arxiv/${p.arxiv_id}`}
                  prefetch={false}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 hover:bg-white/[0.06]"
                >
                  <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-zinc-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-200">{p.title}</div>
                    <div className="truncate text-[11px] text-zinc-500">
                      {p.authors.slice(0, 3).join(", ")}
                      {tag ? ` · #${tag}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 text-right text-sm font-black tabular-nums ${st.text}`}>
                    {st.emoji} {p.final_score.toFixed(2)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
