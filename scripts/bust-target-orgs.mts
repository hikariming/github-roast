import "./_env.mjs";
import { Redis } from "@upstash/redis";
const r = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
const TARGET_ORGS = [
  "langgenius","langchain-ai","run-llama","crewAIInc","Significant-Gravitas","n8n-io","ollama",
  "chroma-core","qdrant","milvus-io","weaviate","BerriAI","openbmb","infiniflow","duckdb",
  "clickhouse","prisma","temporalio","dagger","hasura","meilisearch","sveltejs","tailwindlabs",
  "withastro","oven-sh","biomejs","trpc","remix-run","supabase","appwrite","directus","strapi","posthog",
];
const keys = ["facets:cat:org", ...TARGET_ORGS.map((o) => `facets:list:org:${o}`)];
const n = await r.del(...keys);
console.log("deleted keys:", n, "of", keys.length, "attempted");
