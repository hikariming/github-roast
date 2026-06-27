"use client";

import { useEffect, useState } from "react";
import { tierStyle } from "@/lib/tier";
import type { Tier } from "@/lib/types";

interface Entry {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  final_score: number;
  tier: Tier;
}

const RANK_BADGE = ["🥇", "🥈", "🥉"];

export function Leaderboard({ pageSize }: { pageSize?: number }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setEntries((d.entries as Entry[]) ?? []);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return <p className="text-center text-zinc-500">榜单暂时加载不出来，稍后再试。</p>;
  }
  if (entries === null) {
    return <p className="text-center text-zinc-500 animate-pulse">加载名人堂…</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="text-center text-zinc-500">
        名人堂还空着 —— 去首页扫出第一个 60 分以上的高手吧。
      </p>
    );
  }

  const totalPages = pageSize ? Math.max(1, Math.ceil(entries.length / pageSize)) : 1;
  const current = Math.min(page, totalPages - 1);
  const visible = pageSize ? entries.slice(current * pageSize, (current + 1) * pageSize) : entries;
  const offset = pageSize ? current * pageSize : 0;

  return (
    <>
      <ol className="flex flex-col gap-2">
        {visible.map((e, i) => {
          const rank = offset + i;
          const style = tierStyle(e.tier);
          return (
            <li
              key={e.username}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <span className="w-8 shrink-0 text-center text-sm font-bold tabular-nums text-zinc-400">
                {RANK_BADGE[rank] ?? rank + 1}
              </span>
            {e.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.avatar_url}
                alt={e.username}
                className="h-9 w-9 shrink-0 rounded-full"
              />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-full bg-white/10" />
            )}
            <div className="min-w-0 flex-1">
              <a
                href={e.profile_url ?? `https://github.com/${e.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate font-medium hover:underline"
              >
                @{e.username}
              </a>
              {e.display_name && (
                <span className="block truncate text-xs text-zinc-500">{e.display_name}</span>
              )}
            </div>
            <span className={`shrink-0 text-xs font-medium ${style.text}`}>
              {style.emoji} {e.tier}
            </span>
            <span className={`w-16 shrink-0 text-right text-lg font-black tabular-nums ${style.text}`}>
              {e.final_score.toFixed(2)}
            </span>
          </li>
          );
        })}
      </ol>

      {pageSize && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={current === 0}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-zinc-300 hover:bg-white/10 disabled:opacity-40"
          >
            ← 上一页
          </button>
          <span className="tabular-nums text-zinc-500">
            {current + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={current >= totalPages - 1}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-zinc-300 hover:bg-white/10 disabled:opacity-40"
          >
            下一页 →
          </button>
        </div>
      )}
    </>
  );
}
