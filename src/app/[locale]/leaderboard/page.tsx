import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Leaderboard } from "@/components/Leaderboard";
import type { LeaderboardView } from "@/components/LeaderboardClient";

export const dynamic = "force-dynamic";

const REMOVAL_ISSUE_URL =
  "https://github.com/hikariming/github-roast/issues/new?title=%E7%94%B3%E8%AF%B7%E4%B8%8B%E6%A6%9C&body=%E8%AF%B7%E5%A1%AB%E5%86%99%E4%BD%A0%E7%9A%84%20GitHub%20%E7%94%A8%E6%88%B7%E5%90%8D%EF%BC%9A";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leaderboard" });
  return {
    title: `${t("heading")} · ${(await getTranslations({ locale, namespace: "meta" }))("siteName")}`,
    description: t("subtitle"),
  };
}

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const view: LeaderboardView = query?.view === "heat" ? "heat" : "score";
  await connection();
  setRequestLocale(locale);
  const t = await getTranslations("leaderboard");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-14 sm:py-20">
      <header className="mb-8">
        <div className="flex flex-col items-start gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 max-w-full flex-1 flex-wrap items-center gap-x-4 gap-y-3 sm:gap-x-6">
            <Link
              href="/leaderboard"
              className={`shrink-0 text-3xl font-black leading-tight tracking-tight sm:text-4xl ${
                view === "score" ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {t("heading")}
            </Link>
            <span className="h-14 w-1 shrink-0 rotate-12 rounded-full bg-[rgb(255,105,0)] sm:h-20" />
            <Link
              href="/leaderboard?view=heat"
              className={`shrink-0 text-xl font-black leading-tight sm:text-2xl ${
                view === "heat" ? "text-zinc-100" : "text-zinc-500 hover:text-red-300"
              }`}
            >
              {t("heatView")}
            </Link>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-full bg-orange-600 px-4 py-2 text-xs font-medium text-white hover:bg-orange-500 sm:px-5 sm:text-sm"
          >
            {t("judgeCta")}
          </Link>
        </div>
        <p className="mt-2 text-zinc-400">{t("subtitle")}</p>
      </header>

      <Leaderboard pageSize={20} initialView={view} />

      <footer className="mt-12 text-center text-xs leading-relaxed text-zinc-600">
        {t.rich("footerNote", {
          a: (c) => (
            <a
              href={REMOVAL_ISSUE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
            >
              {c}
            </a>
          ),
        })}
      </footer>
    </main>
  );
}
