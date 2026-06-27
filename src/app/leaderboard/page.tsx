import Link from "next/link";
import type { Metadata } from "next";
import { Leaderboard } from "@/components/Leaderboard";

export const metadata: Metadata = {
  title: "名人堂 · 毒舌 GitHub 评分",
  description: "GitHub 价值评分名人堂 —— 公开数据中的高分开发者排行榜。",
};

export default function LeaderboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-14 sm:py-20">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">🏆 名人堂</h1>
        <p className="mt-2 text-zinc-400">评分 60 分以上即可上榜。</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-full bg-orange-600 px-5 py-2 text-sm font-medium text-white hover:bg-orange-500"
        >
          ← 去审判一个账号
        </Link>
      </header>

      <Leaderboard />

      <footer className="mt-12 text-center text-xs leading-relaxed text-zinc-600">
        仅收录基于 GitHub 公开数据的高分账号。如需将自己从榜单移除，
        <a
          href="https://github.com/hikariming/github-roast/issues/new?title=%E7%94%B3%E8%AF%B7%E4%B8%8B%E6%A6%9C&body=%E8%AF%B7%E5%A1%AB%E5%86%99%E4%BD%A0%E7%9A%84%20GitHub%20%E7%94%A8%E6%88%B7%E5%90%8D%EF%BC%9A"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
        >
          点此申请下榜
        </a>
        。
      </footer>
    </main>
  );
}
