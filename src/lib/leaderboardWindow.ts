// Shared, runtime-safe leaderboard time-window definitions. This module has no
// "use client" pragma and no side effects, so both server components (the full
// /leaderboard page) and client components (home board, LeaderboardClient) can
// import the option list as a real array. A value exported from a "use client"
// module becomes a module reference — not the array — when read across the RSC
// boundary, which is why these can't live in LeaderboardClient.tsx.
export type LeaderboardWindow = "24h" | "7d" | "30d" | "all";

// Display order for the time-window selector.
export const LEADERBOARD_WINDOW_OPTIONS: LeaderboardWindow[] = ["24h", "7d", "30d", "all"];
