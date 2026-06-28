import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaperRoaster } from "@/components/PaperRoaster";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paperMeta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { languages: { "zh-CN": "/arxiv", en: "/en/arxiv" } },
    openGraph: { title: t("title"), description: t("description"), type: "website" },
  };
}

export default async function ArxivPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("paper");

  return (
    <main className="flex flex-1 flex-col items-center px-5 py-14 sm:py-20">
      <header className="mb-8 flex flex-col items-center text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
          {t("betaPill")}
        </span>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{t("heading")}</h1>
        <p className="mt-3 max-w-md text-zinc-400">{t("tagline")}</p>
      </header>
      <PaperRoaster />
    </main>
  );
}
