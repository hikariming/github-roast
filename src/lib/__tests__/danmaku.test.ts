import { describe, expect, it } from "vitest";
import {
  DANMAKU_MAX_PER_LANG,
  interleaveDanmakuByLang,
  normalizeDanmakuLines,
  type DanmakuLine,
} from "../danmaku";

describe("normalizeDanmakuLines", () => {
  it("keeps well-formed per-language lines", () => {
    const out = normalizeDanmakuLines([
      { lang: "zh", text: "这分数有点东西" },
      { lang: "en", text: "this score is legit" },
    ]);
    expect(out).toEqual([
      { lang: "zh", text: "这分数有点东西" },
      { lang: "en", text: "this score is legit" },
    ]);
  });

  it("infers language from CJK content when lang is missing", () => {
    const out = normalizeDanmakuLines([{ text: "顶级开源选手" }, { text: "ships real code" }]);
    expect(out).toEqual([
      { lang: "zh", text: "顶级开源选手" },
      { lang: "en", text: "ships real code" },
    ]);
  });

  it("strips leading @ / # and collapses whitespace", () => {
    const out = normalizeDanmakuLines([{ lang: "zh", text: "  @#  榜单常驻  " }]);
    expect(out[0].text).toBe("榜单常驻");
  });

  it("dedupes within a language and drops empties", () => {
    const out = normalizeDanmakuLines([
      { lang: "zh", text: "厉害" },
      { lang: "zh", text: "厉害" },
      { lang: "en", text: "" },
    ]);
    expect(out).toEqual([{ lang: "zh", text: "厉害" }]);
  });

  it("caps each language to DANMAKU_MAX_PER_LANG independently", () => {
    const many: unknown[] = [];
    for (let i = 0; i < 20; i++) many.push({ lang: "zh", text: `中文${i}` });
    for (let i = 0; i < 20; i++) many.push({ lang: "en", text: `english ${i}` });
    const out = normalizeDanmakuLines(many);
    expect(out.filter((l) => l.lang === "zh")).toHaveLength(DANMAKU_MAX_PER_LANG);
    expect(out.filter((l) => l.lang === "en")).toHaveLength(DANMAKU_MAX_PER_LANG);
  });

  it("returns [] for non-arrays", () => {
    expect(normalizeDanmakuLines(null)).toEqual([]);
    expect(normalizeDanmakuLines("nope")).toEqual([]);
    expect(normalizeDanmakuLines({})).toEqual([]);
  });
});

describe("interleaveDanmakuByLang", () => {
  it("alternates zh and en for a mixed wall", () => {
    const lines: DanmakuLine[] = [
      { lang: "zh", text: "甲" },
      { lang: "zh", text: "乙" },
      { lang: "en", text: "a" },
      { lang: "en", text: "b" },
    ];
    expect(interleaveDanmakuByLang(lines).map((l) => l.text)).toEqual(["甲", "a", "乙", "b"]);
  });

  it("appends the remainder when one language is longer", () => {
    const lines: DanmakuLine[] = [
      { lang: "zh", text: "甲" },
      { lang: "zh", text: "乙" },
      { lang: "en", text: "a" },
    ];
    expect(interleaveDanmakuByLang(lines).map((l) => l.text)).toEqual(["甲", "a", "乙"]);
  });
});
