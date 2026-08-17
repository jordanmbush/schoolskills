// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { WORLDS } from "./src/engine/worlds";
import { pathOf, sitemapGuard } from "./scripts/sitemap-guard.mjs";

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
       * be added to the map and quietly left in the sitemap.
       *
       * Keyed on `island`, NOT on `href`. For the three game worlds those are
       * the same string and the distinction looks academic; The Print Shop is
       * where it stops being academic, because its `href` is a catalog of
       * prerendered worksheets that has to be indexed and its island is a
       * builder that must not be. Filtering on `href` would have removed the
       * catalog silently. sitemapGuard below fails the build if it ever does.
       */
      filter: (page) => {
        const path = pathOf(page);
        return !WORLDS.some((world) => world.island === path);
      },
    }),
    // After the sitemap integration, deliberately: it reads what that one
    // wrote. See scripts/sitemap-guard.mjs.
    sitemapGuard(WORLDS),
  ],
  // Emit `/about/index.html` rather than `/about.html` so CloudFront can serve
  // clean URLs from S3 without a rewrite function.
  build: { format: "directory" },
  trailingSlash: "ignore",
});
