import "./_env.mjs";
import { Redis } from "@upstash/redis";
const r = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
const n = await r.del("facets:cat:org", "facets:list:org:langgenius");
console.log("deleted keys:", n);
