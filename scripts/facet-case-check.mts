import "./_env.mjs";
import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
// distinct facet values that look like clickhouse/duckdb/etc, case-insensitive
const r = await db.execute({ sql:`SELECT facet_value, COUNT(*) c FROM developer_facets WHERE facet_type='org' AND lower(facet_value) IN ('clickhouse','duckdb','weaviate','qdrant','langchain-ai','significant-gravitas','crewaiinc','n8n-io') GROUP BY facet_value ORDER BY c DESC`, args:[]});
for (const row of r.rows) console.log(String(row.facet_value).padEnd(24), row.c);
