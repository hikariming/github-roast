import "./_env.mjs";
import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
const orgs = ["langgenius","langchain-ai","run-llama","crewAIInc","Significant-Gravitas","n8n-io","ollama","qdrant","milvus-io","weaviate","infiniflow","duckdb","clickhouse","prisma","temporalio"];
let total=0;
for (const org of orgs) {
  const r = await db.execute({ sql:`SELECT COUNT(*) c FROM developer_facets f JOIN scores s ON s.username=f.username WHERE f.facet_type='org' AND f.facet_value=? AND s.final_score>=60 AND s.hidden=0`, args:[org]});
  const c = Number(r.rows[0].c); total+=c;
  console.log(org.padEnd(22), c);
}
console.log("-----"); console.log("TOTAL directory-visible across these orgs:", total);
