import { describe, expect, it } from "vitest";
import { computeFloodSignals, isEcosystemImpactPr } from "../github";
import { logRatio, score, tierFor } from "../score";
import type { RawMetrics, RecentPr } from "../types";
import fixtures from "./score-fixtures.json";

const pr = (over: Partial<RecentPr>): RecentPr => ({
  title: "x",
  repo: "owner/repo",
  repo_stars: 0,
  churn: 100,
  changed_files: 3,
  trivial: false,
  ...over,
});

/** A neutral, established account that trips no red flags — override per test. */
const NEUTRAL: RawMetrics = {
  username: "x",
  profile_url: null,
  avatar_url: null,
  name: "X",
  bio: "dev",
  company: null,
  account_age_years: 5,
  created_at: "2019-01-01T00:00:00Z",
  followers: 50,
  following: 30,
  public_repos: 20,
  fetched_repo_count: 20,
  original_repo_count: 10,
  nonempty_original_repo_count: 5,
  fork_repo_count: 2,
  empty_original_repo_count: 0,
  total_stars: 100,
  max_stars: 50,
  merged_pr_count: 30,
  total_pr_count: 35,
  issues_created: 10,
  last_year_contributions: 500,
  activity_type_count: 3,
  contribution_years_active: 3,
  days_since_last_activity: 30,
  recent_merged_pr_sample: 20,
  recent_trivial_pr_count: 2,
  max_impact_repo_stars: 0,
  impact_pr_count: 0,
  impact_depth_raw: 0,
  self_pr_farm_count: 0,
  self_pr_farm_ratio: 0,
  star_inflation_suspect: false,
  closed_unmerged_pr_count: 2,
  pr_rejection_rate: 0.06,
  recent_pr_sample: 20,
  top_repo_pr_target: "a/b",
  top_repo_pr_share: 0.3,
  templated_pr_ratio: 0.2,
  pr_flood_suspect: false,
};

const hasFlag = (m: RawMetrics, name: string) =>
  score(m).red_flags.some((f) => f.flag === name);

describe("spam-PR red flags", () => {
  it("does not fire on a neutral account", () => {
    expect(score(NEUTRAL).red_flags).toHaveLength(0);
  });

  it("flags templated_pr_flooding when the flood heuristic is suspect", () => {
    const m: RawMetrics = {
      ...NEUTRAL,
      pr_flood_suspect: true,
      recent_pr_sample: 18,
      top_repo_pr_target: "langgenius/dify",
      top_repo_pr_share: 0.8,
      templated_pr_ratio: 0.75,
    };
    expect(hasFlag(m, "templated_pr_flooding")).toBe(true);
  });

  it("flags high_pr_rejection when most decided PRs were rejected", () => {
    const m: RawMetrics = {
      ...NEUTRAL,
      merged_pr_count: 5,
      closed_unmerged_pr_count: 20,
      pr_rejection_rate: 0.8,
    };
    const flag = score(m).red_flags.find((f) => f.flag === "high_pr_rejection");
    expect(flag).toBeTruthy();
    expect(flag?.penalty).toBe(10); // >0.7 → 10
  });

  it("does not flag rejection below the threshold or with too few PRs", () => {
    expect(hasFlag({ ...NEUTRAL, pr_rejection_rate: 0.4 }, "high_pr_rejection")).toBe(false);
    expect(
      hasFlag(
        { ...NEUTRAL, merged_pr_count: 3, closed_unmerged_pr_count: 4, pr_rejection_rate: 0.57 },
        "high_pr_rejection",
      ),
    ).toBe(false); // decided 7 < 10
  });
});

describe("computeFloodSignals", () => {
  it("flags a cqjjjzr-style one-repo templated burst", () => {
    const titles = [
      ...Array.from({ length: 15 }, (_, i) => `refactor(api): migrate ${i} endpoints to BaseModel`),
      "refactor(api): remove legacy field compatibility",
      "refactor(api): remove member field compatibility",
      "chore: rehearse ordered BaseModel migration merge",
    ];
    const prs = titles.map((title) => ({ title, repo: "langgenius/dify" }));
    const s = computeFloodSignals(prs);
    expect(s.pr_flood_suspect).toBe(true);
    expect(s.top_repo_pr_target).toBe("langgenius/dify");
    expect(s.top_repo_pr_share).toBe(1);
    expect(s.templated_pr_ratio).toBeGreaterThanOrEqual(0.5);
    expect(s.flood_pr_titles.length).toBeGreaterThan(0);
  });

  it("does not flag varied PRs across many repos", () => {
    const prs = [
      { title: "fix: handle null pointer in parser", repo: "a/one" },
      { title: "docs: clarify install steps", repo: "b/two" },
      { title: "feat: add export to csv", repo: "c/three" },
      { title: "perf: cache compiled regex", repo: "d/four" },
      { title: "test: cover edge cases", repo: "e/five" },
      { title: "refactor: split god object", repo: "f/six" },
      { title: "ci: bump node version", repo: "g/seven" },
      { title: "fix: race in scheduler", repo: "h/eight" },
      { title: "feat: dark mode toggle", repo: "i/nine" },
      { title: "chore: update deps", repo: "j/ten" },
      { title: "fix: typo in readme", repo: "k/eleven" },
      { title: "feat: pagination support", repo: "l/twelve" },
    ];
    expect(computeFloodSignals(prs).pr_flood_suspect).toBe(false);
  });

  it("handles an empty list", () => {
    expect(computeFloodSignals([]).pr_flood_suspect).toBe(false);
  });
});

/**
 * Parity test: the TS port of `score()` must reproduce, byte-for-byte, the output
 * of the canonical Python skill (`fetch_github_profile.py`). Fixtures are the
 * Python `score()` output captured for representative account shapes — see
 * scripts that regenerate them in the README. If these drift, the website and the
 * open-source skill would disagree on the number.
 */
describe("score() parity with Python skill", () => {
  for (const [name, { input, expected }] of Object.entries(fixtures)) {
    it(`matches Python output for "${name}"`, () => {
      const result = score(input as unknown as RawMetrics);
      expect(result).toEqual(expected);
    });
  }
});

describe("isEcosystemImpactPr (dimension 4 qualification)", () => {
  const me = "karpathy";

  it("counts a substantial PR into your OWN ≥1000★ repo (maintainer value)", () => {
    // karpathy → nanoGPT etc.: maintaining a hugely popular project you created.
    expect(isEcosystemImpactPr(pr({ repo: "karpathy/nanoGPT", repo_stars: 30000 }), me)).toBe(true);
  });

  it("does NOT count PRs into your own <1000★ repo (self-PR-farming pattern)", () => {
    // AsperforMias → own 0-star repos: self-review/self-merge inflation.
    expect(isEcosystemImpactPr(pr({ repo: "asper/junk", repo_stars: 0 }), "asper")).toBe(false);
    expect(isEcosystemImpactPr(pr({ repo: "karpathy/sidequest", repo_stars: 500 }), me)).toBe(false);
  });

  it("counts a substantial PR into an external ≥200★ repo", () => {
    expect(isEcosystemImpactPr(pr({ repo: "langgenius/dify", repo_stars: 5000 }), me)).toBe(true);
  });

  it("does NOT count an external repo below 200★", () => {
    expect(isEcosystemImpactPr(pr({ repo: "someone/tiny", repo_stars: 100 }), me)).toBe(false);
  });

  it("never counts trivial (≤5-line) PRs, even into huge repos", () => {
    expect(
      isEcosystemImpactPr(pr({ repo: "torvalds/linux", repo_stars: 200000, trivial: true }), me),
    ).toBe(false);
  });
});

describe("tierFor (5 bands incl. 顶级)", () => {
  it("maps each score band to the right tier", () => {
    expect(tierFor(95).tier).toBe("夯");
    expect(tierFor(90).tier).toBe("夯");
    expect(tierFor(89.99).tier).toBe("顶级");
    expect(tierFor(80).tier).toBe("顶级");
    expect(tierFor(79.99).tier).toBe("人上人");
    expect(tierFor(70).tier).toBe("人上人");
    expect(tierFor(69.99).tier).toBe("NPC");
    expect(tierFor(40).tier).toBe("NPC");
    expect(tierFor(39.99).tier).toBe("拉完了");
    expect(tierFor(0).tier).toBe("拉完了");
  });
});

describe("logRatio", () => {
  it("returns 0 for non-positive values", () => {
    expect(logRatio(0, 5000)).toBe(0);
    expect(logRatio(-5, 5000)).toBe(0);
  });
  it("caps at 1.0 when value >= full_at", () => {
    expect(logRatio(5000, 5000)).toBe(1);
    expect(logRatio(99999, 5000)).toBe(1);
  });
  it("is monotonic increasing", () => {
    expect(logRatio(10, 5000)).toBeLessThan(logRatio(100, 5000));
  });
});
