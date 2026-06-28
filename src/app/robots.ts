import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Non-HTML endpoints: OG cards, SVG badges, scan/roast/leaderboard/stats
      // APIs. No SEO value and they burn crawl budget, so keep crawlers out.
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
