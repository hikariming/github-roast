import "./_env.mjs";
import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
const u = process.argv[2];
const s = await db.execute({ sql: `SELECT final_score, tier, tags, roast_line, roast, roast_en FROM scores WHERE username=?`, args:[u] });
console.log(JSON.stringify(s.rows[0], null, 2));
const d = await db.execute({ sql: `SELECT lines FROM profile_danmaku WHERE username=?`, args:[u] });
console.log("danmaku:", d.rows[0]?.lines);
