import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collect: vi.fn(),
  score: vi.fn(),
  verifyTurnstile: vi.fn(),
  recordAccountLookup: vi.fn(),
  checkRateLimit: vi.fn(),
  coalesceScan: vi.fn(),
  getCachedScan: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  recordAccountLookup: mocks.recordAccountLookup,
}));

vi.mock("@/lib/github", () => {
  class AccountNotFoundError extends Error {}
  class GitHubAuthRequiredError extends Error {}
  class GitHubDataUnavailableError extends Error {}
  class GitHubRateLimitError extends Error {}
  return {
    AccountNotFoundError,
    GitHubAuthRequiredError,
    GitHubDataUnavailableError,
    GitHubRateLimitError,
    collect: mocks.collect,
  };
});

vi.mock("@/lib/redis", () => ({
  checkRateLimit: mocks.checkRateLimit,
  coalesceScan: mocks.coalesceScan,
  getCachedScan: mocks.getCachedScan,
}));

vi.mock("@/lib/score", () => ({
  score: mocks.score,
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile,
}));

import { POST } from "./route";

const originalCliKey = process.env.GITHUB_ROAST_CLI_API_KEY;

const metrics = {
  username: "DemoDev",
  profile_url: "https://github.com/DemoDev",
  avatar_url: "https://avatars.githubusercontent.com/u/1",
};

const scoring = {
  sub_scores: {
    account_maturity: 1,
    original_project_quality: 2,
    contribution_quality: 3,
    ecosystem_impact: 4,
    community_influence: 5,
    activity_authenticity: 6,
  },
  base_score: 21,
  red_flags: [],
  total_penalty: 0,
  final_score: 21,
  tier: "NPC",
  tier_label: "普通账号 · 特征平庸存疑",
};

function request(init?: { token?: string; auth?: string }): NextRequest {
  return new NextRequest("https://example.test/api/scan", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(init?.auth ? { authorization: init.auth } : {}),
    },
    body: JSON.stringify({ username: "DemoDev", turnstileToken: init?.token }),
  });
}

describe("scan route machine auth", () => {
  beforeEach(() => {
    process.env.GITHUB_ROAST_CLI_API_KEY = "cli-secret";
    mocks.collect.mockResolvedValue({
      metrics,
      top_repos: [],
      recent_prs: [],
      flood_pr_titles: [],
      impact_repos: [],
      verified_impact_prs: [],
      pinned_repos: [],
      organizations: [],
    });
    mocks.score.mockReturnValue(scoring);
    mocks.verifyTurnstile.mockResolvedValue(false);
    mocks.recordAccountLookup.mockResolvedValue(true);
    mocks.checkRateLimit.mockResolvedValue({ success: true });
    mocks.coalesceScan.mockImplementation(async (_username: string, fn: () => unknown) => fn());
    mocks.getCachedScan.mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalCliKey === undefined) delete process.env.GITHUB_ROAST_CLI_API_KEY;
    else process.env.GITHUB_ROAST_CLI_API_KEY = originalCliKey;
    vi.clearAllMocks();
  });

  it("keeps requiring Turnstile when machine auth is missing", async () => {
    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "turnstile_failed" });
    expect(mocks.verifyTurnstile).toHaveBeenCalledWith(null, "0.0.0.0");
    expect(mocks.collect).not.toHaveBeenCalled();
  });

  it("allows the same scan API to be called by CLI with a bearer token", async () => {
    const response = await POST(request({ auth: "Bearer cli-secret" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.metrics.username).toBe("DemoDev");
    expect(body.scoring.final_score).toBe(21);
    expect(body.cached).toBe(false);
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
    expect(mocks.collect).toHaveBeenCalledWith("DemoDev");
  });
});
