import "./_env.mjs";
import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
for (const org of ["langchain-ai","qdrant","milvus-io","weaviate","ollama","n8n-io","crewAIInc","Significant-Gravitas","run-llama","langgenius"]) {
  const r = await db.execute({
    sql: `SELECT COUNT(*) as c FROM developer_facets f JOIN scores s ON s.username=f.username WHERE f.facet_type='org' AND f.facet_value=? AND s.final_score>=60 AND s.hidden=0`,
    args: [org],
  });
  console.log(org.padEnd(20), r.rows[0].c);
}
