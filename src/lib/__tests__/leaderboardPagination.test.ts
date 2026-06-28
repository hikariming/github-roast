import { describe, expect, it } from "vitest";
import { resolveLeaderboardPageInput } from "../../components/leaderboardPagination";

describe("resolveLeaderboardPageInput", () => {
  it("converts a 1-based page input to a clamped 0-based page index", () => {
    expect(resolveLeaderboardPageInput("3", 0, 5)).toBe(2);
    expect(resolveLeaderboardPageInput("999", 1, 5)).toBe(4);
    expect(resolveLeaderboardPageInput("0", 1, 5)).toBe(0);
  });

  it("keeps the current page for blank or invalid input", () => {
    expect(resolveLeaderboardPageInput("", 2, 5)).toBe(2);
    expect(resolveLeaderboardPageInput("abc", 2, 5)).toBe(2);
  });
});
