import "./_env.mjs";
import {
  getProfileSnapshot,
  listSnapshotUsernames,
  recordDeveloperFacets,
} from "../src/lib/db";
import { extractFacets } from "../src/lib/facets";

/**
 * Local backfill for the /developers discovery facets — the script twin of
 * POST /api/admin/backfill-facets. Reads every already-sedimented profile
 * snapshot (NO GitHub calls) and rewrites developer_facets with the current
 * lib/facets.ts logic, so re-run it after tuning classification. Paginated and
 * strictly sequential (one recordDeveloperFacets batch per user) to stay gentle
 * on the remote DB. Pass `--dry` to tally without writing.
 */
const DRY = process.argv.includes("--dry");
const PAGE = 500;

let offset = 0;
let processed = 0;
let written = 0;
let empty = 0;
let failed = 0;
let repoRows = 0;
let devsWithRepo = 0;

for (;;) {
  const usernames = await listSnapshotUsernames(PAGE, offset);
  if (usernames.length === 0) break;

  for (const username of usernames) {
    try {
      const snapshot = await getProfileSnapshot(username);
      if (!snapshot) {
        empty++;
        continue;
      }
      const facets = extractFacets({
        top_repos: snapshot.top_repos,
        organizations: snapshot.organizations,
        impact_repos: snapshot.impact_repos,
      });
      const repos = facets.filter((f) => f.type === "repo");
      if (repos.length > 0) {
        devsWithRepo++;
        repoRows += repos.length;
      }
      if (facets.length === 0) {
        empty++;
        continue;
      }
      if (!DRY) await recordDeveloperFacets(username, facets);
      written++;
    } catch (e) {
      failed++;
      console.error(`ERR ${username}:`, e instanceof Error ? e.message : String(e));
    }
    processed++;
  }

  console.log(
    `…processed=${processed} written=${written} empty=${empty} failed=${failed} repoRows=${repoRows} devsWithRepo=${devsWithRepo}`,
  );

  if (usernames.length < PAGE) break;
  offset += PAGE;
}

console.log(
  `\nDONE${DRY ? " (dry run — nothing written)" : ""}: processed=${processed} written=${written} empty=${empty} failed=${failed}`,
);
console.log(`repo facets: ${repoRows} rows across ${devsWithRepo} developers`);
process.exit(0);
