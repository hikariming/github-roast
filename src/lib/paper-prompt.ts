/**
 * Prompt builder for arXiv 锐评. Mirrors `prompt.ts`'s control-line convention.
 *
 * The model FIRST emits control lines, then the markdown commentary:
 *   Line `@@SCORES novelty=.. rigor=.. significance=.. clarity=.. reproducibility=..@@`
 *        — each 0–10, STRICT, citation-independent (we add the citation bonus).
 *   Line `@@TLDR zh=..|en=..@@`  — one-sentence gist, bilingual.
 *   Line `@@TAGS zh=a,b,c|en=a,b,c@@` — 3–5 playful tags each.
 *   Then `## ...` markdown report in the requested tone.
 *
 * In `locked` mode the score is already fixed (so it stays stable across tone
 * switches): no `@@SCORES@@`, just `@@TLDR@@`/`@@TAGS@@` + the report explaining
 * the given score in the new tone.
 */

import type { ChatMessage } from "./llm";
import type { Lang } from "./lang";
import type { PaperData, PaperDims, PaperMode } from "./paper-types";

const RUBRIC_ZH = `评分维度(各 0–10,必须严格校准、与引用数无关 —— 引用影响力由系统另行加成):
- novelty 创新性:真正的新思想 vs 增量/换皮。Transformer 这类开创性工作=10;常见 trick 堆叠/灌水=2-4。
- rigor 严谨性:实验/理论是否扎实、对照充分、结论是否被证据支撑。
- significance 意义:对领域的实际影响潜力、问题重要性。
- clarity 清晰度:写作、表达、可理解性。
- reproducibility 可复现性:方法细节、代码/数据、可被复现的程度。`;

const RUBRIC_EN = `Dimensions (each 0–10, STRICT and citation-independent — the system adds the citation bonus separately):
- novelty: genuinely new ideas vs incremental/reskinned. Field-defining work like Transformer = 10; trick-stacking/filler = 2-4.
- rigor: soundness of experiments/theory, baselines, whether claims are supported.
- significance: real potential impact, importance of the problem.
- clarity: writing, presentation, understandability.
- reproducibility: method detail, code/data availability, how reproducible it is.`;

function modeVoiceZh(mode: PaperMode): string {
  return mode === "praise"
    ? "语气=夸夸模式:真诚、热情地夸,放大论文的亮点与贡献,但不得编造、不得抬高分数(分数已严格固定)。"
    : "语气=辣评模式:毒舌、犀利、有梗,狠揭水分、过度宣称、薄弱实验,但对真正的好工作要给予硬核的尊重。攻击工作本身,不攻击作者人格。";
}
function modeVoiceEn(mode: PaperMode): string {
  return mode === "praise"
    ? "Tone = PRAISE: sincerely hype the paper's strengths and contributions — but never fabricate, never inflate the (already fixed) score."
    : "Tone = ROAST: savage, witty, sharp — expose padding, overclaiming, weak experiments; but give hardcore respect to genuinely strong work. Attack the work, never the authors as people.";
}

const REPORT_FORMAT_ZH = `然后输出 markdown 报告(以 ## 开头):一句话定性 → 创新点/贡献 → 问题与水分 → 维度简评 → 一句总评。≤500 字,有梗但专业。`;
const REPORT_FORMAT_EN = `Then a markdown report (start with ##): one-line verdict → contributions → weaknesses/padding → per-dimension notes → closing line. ≤350 words, witty but professional.`;

function systemPrompt(lang: Lang, mode: PaperMode, locked: boolean): string {
  if (lang === "en") {
    const lines = [
      "You are a ruthless, world-class peer reviewer for academic papers. Score STRICTLY — most papers are mediocre; reserve high marks for genuinely strong work.",
      locked
        ? "The score is ALREADY FIXED (given below). Do NOT output @@SCORES@@. Just explain that score in the requested tone."
        : `Output control lines FIRST, then the report.\nLine 1: @@SCORES novelty=<0-10> rigor=<0-10> significance=<0-10> clarity=<0-10> reproducibility=<0-10>@@\n${RUBRIC_EN}`,
      "Line: @@TLDR zh=<one sentence>|en=<one sentence>@@ (bilingual gist, ≤120 chars each).",
      "Line: @@TAGS zh=t1,t2,t3|en=t1,t2,t3@@ (3-5 playful tags each, no # signs).",
      modeVoiceEn(mode),
      REPORT_FORMAT_EN,
    ];
    return lines.join("\n");
  }
  const lines = [
    "你是一位极其严格、世界级的论文审稿人。打分要狠:大多数论文都平庸,高分只留给真正过硬的工作。",
    locked
      ? "分数已固定(见下),不要输出 @@SCORES@@。只需用指定语气解释这个分数。"
      : `先输出控制行,再输出报告。\n第一行:@@SCORES novelty=<0-10> rigor=<0-10> significance=<0-10> clarity=<0-10> reproducibility=<0-10>@@\n${RUBRIC_ZH}`,
    "一行:@@TLDR zh=<一句话>|en=<one sentence>@@(双语一句话主旨,各 ≤120 字)。",
    "一行:@@TAGS zh=标签1,标签2,标签3|en=t1,t2,t3@@(各 3-5 个有梗的标签,不带 # 号)。",
    modeVoiceZh(mode),
    REPORT_FORMAT_ZH,
  ];
  return lines.join("\n");
}

export function buildPaperMessages(opts: {
  paper: PaperData;
  mode: PaperMode;
  lang: Lang;
  /** When set, the score is fixed (tone-switch path) — no rubric is requested. */
  locked?: { score: number; dims: PaperDims };
}): ChatMessage[] {
  const { paper, mode, lang, locked } = opts;
  const payload = {
    title: paper.title,
    authors: paper.authors.slice(0, 12),
    categories: paper.categories,
    published: paper.published,
    citation_count: paper.citation_count,
    influential_citation_count: paper.influential_citation_count,
    venue: paper.venue,
    abstract: paper.abstract,
    ...(locked ? { fixed_final_score: locked.score, fixed_dimensions: locked.dims } : {}),
  };
  const preamble =
    lang === "en"
      ? "Review this arXiv paper. Citations/venue are context for impact, but you only score the content dimensions; the system adds the citation bonus."
      : "评审这篇 arXiv 论文。引用数/会议仅作影响力参考,你只给内容维度打分,引用加成由系统另算。";
  return [
    { role: "system", content: systemPrompt(lang, mode, !!locked) },
    { role: "user", content: `${preamble}\n\n${JSON.stringify(payload)}` },
  ];
}
