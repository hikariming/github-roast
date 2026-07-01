import "./_env.mjs";
import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
const r = await db.execute({ sql:`
  SELECT f.facet_value v, COUNT(*) total,
         SUM(CASE WHEN s.final_score>=60 AND s.hidden=0 THEN 1 ELSE 0 END) visible
  FROM developer_facets f JOIN scores s ON s.username=f.username
  WHERE f.facet_type='org' AND lower(f.facet_value) IN
    ('langgenius','langchain-ai','run-llama','crewaiinc','significant-gravitas','n8n-io','ollama','qdrant','milvus-io','weaviate','infiniflow','duckdb','clickhouse','prisma','temporalio','hasura','meilisearch','sveltejs','tailwindlabs','withastro','dagger')
  GROUP BY f.facet_value HAVING visible>0 ORDER BY visible DESC`, args:[]});
let tv=0,tt=0;
for (const row of r.rows){ tv+=Number(row.visible); tt+=Number(row.total); console.log(String(row.v).padEnd(22),"visible:",String(row.visible).padStart(3)," total:",row.total);}
console.log("-----","TOTAL visible:",tv,"| rows:",tt);
