import { getTranslations } from "next-intl/server";
import { getHeatLeaderboard, getLeaderboard, getProgressLeaderboard } from "@/lib/db";
import {
  LeaderboardClient,
  type LeaderboardLabels,
  type LeaderboardView,
} from "./LeaderboardClient";

export async function Leaderboard({
  initialView = "score",
  pageSize,
}: {
  initialView?: LeaderboardView;
  pageSize?: number;
}) {
  const t = await getTranslations("leaderboard");
  const labels: LeaderboardLabels = {
    empty: t("empty"),
    prev: t("prev"),
    next: t("next"),
    pageJumpLabel: t("pageJumpLabel"),
    collapse: t("collapse"),
    viewDetail: t("viewDetail", { username: "{username}" }),
    heatLabel: t("heatLabel"),
    heatTitle: t("heatTitle"),
    progressLabel: t("progressLabel"),
    progressTitle: t("progressTitle"),
    progressEmpty: t("progressEmpty"),
  };

  const [scoreEntries, heatEntries, progressEntries] = await Promise.all([
    initialView === "score" ? getLeaderboard(500) : Promise.resolve([]),
    initialView === "heat" ? getHeatLeaderboard(500) : Promise.resolve([]),
    initialView === "progress" ? getProgressLeaderboard(500) : Promise.resolve([]),
  ]);

  return (
    <LeaderboardClient
      key={initialView}
      initialView={initialView}
      labels={labels}
      pageSize={pageSize}
      scoreEntries={scoreEntries}
      heatEntries={heatEntries}
      progressEntries={progressEntries}
    />
  );
}
