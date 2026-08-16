// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { WORLDS } from "./src/engine/worlds";

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
  integrations: [
    react(),
    sitemap({
      /*
       * The game routes are not in the sitemap, because they carry
       * `noindex` (see Base.astro): each one is a `client:only` island whose
       * prerendered body is two words, so there is nothing to rank and a
       * shelf of near-empty pages is a thin-content signal against the whole
       * domain. Submitting a URL while telling Google to ignore it is a
       * contradiction Search Console reports back at you.
       *
       * Derived from WORLDS rather than written out, so a new world cannot
       * be added to the map and quietly left in the sitemap — `href` on a
       * world IS its game route.
       */
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, "");
        return !WORLDS.some((world) => world.href === path);
      },
    }),
  ],
  // Emit `/about/index.html` rather than `/about.html` so CloudFront can serve
  // clean URLs from S3 without a rewrite function.
  build: { format: "directory" },
  trailingSlash: "ignore",
});
