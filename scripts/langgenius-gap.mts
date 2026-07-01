import "./_env.mjs";
import { createClient } from "@libsql/client";
const ORG = "langgenius";
const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
const f = await db.execute({ sql: `SELECT username FROM developer_facets WHERE facet_type='org' AND facet_value=?`, args: [ORG] });
console.log("facet rows:", f.rows.map(r=>r.username).join(", "));
// snapshots: do scored members have snapshots with langgenius in organizations?
const scored = ["crazywoola","goocarlos","hyoban","laipz8200","lyzno1","rockchinq","samzong","wh-2099","wtw0313"];
for (const u of scored) {
  const s = await db.execute({ sql:`SELECT organizations, scanned_at FROM profile_snapshots WHERE username=? ORDER BY scanned_at DESC LIMIT 1`, args:[u]});
  const has = f.rows.some(r=>String(r.username)===u);
  const orgs = s.rows[0]? (s.rows[0].organizations as string) : "(no snapshot)";
  const orgList = orgs.startsWith("[")? JSON.parse(orgs): orgs;
  console.log(`${u}  facet=${has?"YES":"NO "}  snapshotOrgs=${Array.isArray(orgList)?orgList.join("|"):orgList}`);
}
