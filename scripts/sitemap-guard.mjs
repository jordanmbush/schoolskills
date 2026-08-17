// @ts-check
import { readFile } from "node:fs/promises";

/**
 * The build-time check that the sitemap still says what the map says.
 *
 * `astro.config.mjs` filters routes out of the sitemap from the world
 * registry, which is the right way round — a new world can't be added to the
 * map and quietly left in. But a filter is silent by construction: it can only
 * ever remove, and the failure mode that matters is removing too much. The
 * Print Shop is the case that made this necessary. Its front door is a catalog
 * of prerendered worksheets, the largest crawlable surface on the site; a
 * filter keyed on `href` rather than on `island` would have deleted every one
 * of those URLs from the sitemap with nothing failing and no test catching it
 * (docs/printables.md §8).
 *
 * So the same registry is read twice, from opposite ends: once to decide what
 * to leave out, and once — here, against the file that actually shipped — to
 * assert that what's left is what was meant. A build that gets it wrong fails
 * rather than deploying.
 */

/**
 * An absolute URL as the path a `WorldInfo` would have written: no origin, no
 * trailing slash.
 *
 * Shared with the sitemap filter in astro.config.mjs rather than written out
 * twice, because the two have to agree exactly. One of them deciding that
 * `/printables/make/` and `/printables/make` are different strings is a bug
 * neither would report.
 *
 * @param {string} loc
 * @returns {string}
 */
export const pathOf = (loc) => new URL(loc).pathname.replace(/\/$/, "");

/**
 * Pathnames in a sitemap, in the form the world registry writes them.
 *
 * @param {string} xml
 * @returns {Set<string>}
 */
export function locations(xml) {
  return new Set(
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => pathOf(m[1])),
  );
}

/**
 * Every way the shipped sitemap and the world registry can disagree, as lines
 * a human can act on. An empty array is the passing case.
 *
 * Two rules, and they are opposites of each other:
 *
 *   · An island is `noindex` (see Base.astro), so submitting it is telling
 *     Google to crawl a page we've asked it to ignore — a contradiction
 *     Search Console reports back at you.
 *   · A world's crawlable pages — its front door where that differs from the
 *     island, and its guide where it has one — exist to be found. Missing
 *     from the sitemap is the failure nobody notices, because the site still
 *     builds, still deploys and still looks right.
 *
 * @param {string} xml
 * @param {import("../src/engine/worlds").WorldInfo[]} worlds
 * @returns {string[]}
 */
export function auditSitemap(xml, worlds) {
  const found = locations(xml);
  const problems = [];

  for (const world of worlds) {
    if (found.has(world.island)) {
      problems.push(
        `${world.island} is in the sitemap, but it is ${world.name}'s island and carries noindex.`,
      );
    }
    const crawlable = [
      ...(world.href === world.island ? [] : [world.href]),
      ...(world.guide ? [world.guide.href] : []),
    ];
    for (const href of crawlable) {
      if (!found.has(href)) {
        problems.push(
          `${href} is missing from the sitemap — it is ${world.name}'s crawlable front door and is meant to be indexed.`,
        );
      }
    }
  }

  return problems;
}

/**
 * Wired into `astro.config.mjs` AFTER the sitemap integration, which is
 * load-bearing: Astro runs `astro:build:done` hooks in the order integrations
 * are registered, and there is nothing to read until @astrojs/sitemap has
 * written it.
 *
 * @param {import("../src/engine/worlds").WorldInfo[]} worlds
 * @returns {import("astro").AstroIntegration}
 */
export function sitemapGuard(worlds) {
  return {
    name: "sitemap-guard",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const file = new URL("sitemap-0.xml", dir);
        let xml;
        try {
          xml = await readFile(file, "utf8");
        } catch {
          throw new Error(
            `No sitemap at ${file.pathname}. @astrojs/sitemap did not write one, so this build would ship with nothing submitted to search engines at all.`,
          );
        }

        const problems = auditSitemap(xml, worlds);
        if (problems.length > 0) {
          throw new Error(
            [
              "The sitemap and the world registry disagree:",
              ...problems.map((line) => `  · ${line}`),
              "",
              "Both are derived from src/engine/worlds.ts — see the `island` field there, and the filter in astro.config.mjs.",
            ].join("\n"),
          );
        }

        logger.info(
          `sitemap checked — ${locations(xml).size} URLs, no noindex routes among them`,
        );
      },
    },
  };
}
