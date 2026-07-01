import "./_env.mjs";
const token = process.env.GITHUB_TOKEN!;
const gh = async (url: string) => {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "gh-roast-audit" },
  });
  return r;
};

const ORGS = [
  // AI / LLM tooling (langgenius peers)
  "langchain-ai","run-llama","crewAIInc","Significant-Gravitas","n8n-io","ollama",
  "chroma-core","qdrant","milvus-io","weaviate","BerriAI","openbmb","infiniflow",
  // dev infra / databases
  "duckdb","clickhouse","prisma","temporalio","dagger","hasura","meilisearch",
  // web frameworks / tools
  "sveltejs","tailwindlabs","withastro","oven-sh","biomejs","trpc","remix-run",
  // backend-as-service
  "supabase","appwrite","directus","strapi","PostHog",
];

const results: { org: string; count: number; members: string[] }[] = [];
for (const org of ORGS) {
  try {
    const members: string[] = [];
    for (let page = 1; page <= 5; page++) { // cap 500 members per org for recon
      const r = await gh(`https://api.github.com/orgs/${org}/members?per_page=100&page=${page}`);
      if (!r.ok) { console.log(`${org}: HTTP ${r.status}`); break; }
      const arr = (await r.json()) as { login: string }[];
      members.push(...arr.map((m) => m.login));
      if (arr.length < 100) break;
    }
    results.push({ org, count: members.length, members });
    console.log(`${org.padEnd(20)} members(public, capped500)=${members.length}`);
  } catch (e) {
    console.log(`${org}: ERROR ${e instanceof Error ? e.message : e}`);
  }
}
const total = results.reduce((s, r) => s + r.count, 0);
console.log(`\nTOTAL raw (with dup across orgs possible): ${total}`);
const uniq = new Set(results.flatMap((r) => r.members.map((m) => m.toLowerCase())));
console.log(`UNIQUE usernames across all orgs: ${uniq.size}`);

// write full list to a scratch file for the next step
import { writeFileSync } from "node:fs";
writeFileSync("scripts/_org-members.json", JSON.stringify(results, null, 2));
