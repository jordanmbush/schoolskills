// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

/**
 * Static output, deliberately.
 *
 * Every page is HTML on disk before a request arrives — that is the whole SEO
 * argument, and it's what lets the site live on S3 + CloudFront with no origin
 * server to run, patch or pay for. Games mount as React islands inside those
 * pages (`client:only="react"`), so the interactive surface stays React while
 * the content surface stays crawlable.
 *
 * `site` is not decorative: @astrojs/sitemap and every canonical URL are built
 * from it, so a wrong value here silently poisons the sitemap.
 */
export default defineConfig({
  site: "https://schoolskills.app",
  output: "static",
  integrations: [react(), sitemap()],
  // Emit `/about/index.html` rather than `/about.html` so CloudFront can serve
  // clean URLs from S3 without a rewrite function.
  build: { format: "directory" },
  trailingSlash: "ignore",
});
