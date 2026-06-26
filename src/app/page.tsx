import Link from "next/link";
import { DeveloperCount } from "@/components/DeveloperCount";
import { Leaderboard } from "@/components/Leaderboard";
import { Roaster } from "@/components/Roaster";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-5 py-14 sm:py-20">
      {/* Prominent leaderboard entry, pinned to the very top */}
      <Link
        href="/leaderboard"
        className="group mb-8 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-4 py-2 text-sm font-medium text-amber-200 shadow-[0_0_30px_-10px_rgba(251,191,36,0.6)] transition hover:border-amber-300/70 hover:from-amber-500/25 hover:to-orange-500/25"
      >
        <span className="text-base">🏆</span>
        名人堂排行榜
        <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">
          看谁最强
        </span>
        <span className="transition group-hover:translate-x-0.5">→</span>
      </Link>

      <header className="mb-10 flex flex-col items-center text-center">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-zinc-400">
          <span>作者 hikariming，欢迎关注 👉</span>
          <a
            href="https://github.com/hikariming"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-zinc-300 hover:bg-white/10"
          >
            GitHub
          </a>
          <a
            href="https://www.xiaohongshu.com/user/profile/63d3f4cc00000000260105e2"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-rose-300 hover:bg-white/10"
          >
            小红书
          </a>
          <a
            href="https://x.com/owmio39659"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-zinc-200 hover:bg-white/10"
          >
            X
          </a>
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          毒舌 <span className="text-orange-500">GitHub</span> 评分
        </h1>
        <p className="mt-3 max-w-md text-zinc-400">
          输入一个 GitHub 账号，得到 0–100 分的价值与信任评分，外加一句扎心又有梗的毒舌点评。
        </p>
        <DeveloperCount />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
          {[
            ["🏆 夯", "text-amber-300"],
            ["🥇 顶级", "text-violet-300"],
            ["💪 人上人", "text-emerald-300"],
            ["🫥 NPC", "text-slate-300"],
            ["💀 拉完了", "text-rose-400"],
          ].map(([label, cls]) => (
            <span
              key={label}
              className={`rounded-full border border-white/10 px-2.5 py-1 ${cls}`}
            >
              {label}
            </span>
          ))}
        </div>
      </header>

      <Roaster />

      {/* Embedded leaderboard (paginated) so the board is visible without leaving */}
      <section className="mt-16 w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">🏆 名人堂</h2>
          <Link
            href="/leaderboard"
            className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
          >
            打开完整榜单 →
          </Link>
        </div>
        <Leaderboard pageSize={10} />
      </section>

      <footer className="mt-20 max-w-xl text-center text-xs leading-relaxed text-zinc-600">
        <p>
          本站仅基于 GitHub <strong>公开数据</strong>自动生成评分与点评，吐槽的是账号的公开行为与数据，
          非针对个人。结果不构成对任何人的事实认定，请勿用于骚扰。
        </p>
        <p className="mt-2">
          评分核心开源于{" "}
          <code className="text-zinc-400">github-account-value</code> 技能 ·
          自带 Key 仅存于你的浏览器本地。
        </p>
      </footer>
    </main>
  );
}
