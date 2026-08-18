// @ts-check
import { readFile, readdir } from "node:fs/promises";

/**
 * The build-time check that the search index and the shop are the same shop.
 *
 * The index is a projection of `_shelves.ts` and cannot list a sheet the
 * catalogs don't hold — that much is types. What types cannot say is whether
 * the page it points at was written, or whether a page that WAS written is
 * findable, and both of those are the failure this epic has already shipped
 * twice at a smaller scale: copy describing sheets that weren't there. A search
 * box is that same failure with a hundred and nineteen chances to make it, in
 * both directions at once —
 *
 *   · a row whose route 404s is a catalog advertising paper it hasn't got, and
 *   · a page nothing in the index reaches is a sheet that was built, deployed,
 *     and can only be found by somebody who already knows its URL.
 *
 * Neither shows up in a test, because a test knows what the catalog says and
 * the disagreement is with `dist/`. So the same data is read from both ends,
 * exactly as `sitemap-guard.mjs` does with the world registry: once to write
 * the file, and once — here, against the directory that actually shipped — to
 * assert that what is on disk is what was meant.
 */

/** Where a route's HTML lands, with `build.format: "directory"`. */
const PAGE = "index.html";

/**
 * The routes a built directory holds, as the paths a catalog writes them.
 *
 * Only `/printables`: this guard has an opinion about the Print Shop and none
 * about the rest of the site, and a hub somewhere else that grows a page is not
 * something a worksheet index should start failing builds over.
 *
 * @param {string[]} files paths relative to `dist/`, as `readdir` returns them
 * @returns {string[]}
 */
export function catalogRoutes(files) {
  return files
    .filter(
      (file) => file.startsWith("printables/") && file.endsWith(`/${PAGE}`),
    )
    .map((file) => `/${file.slice(0, -(PAGE.length + 1))}`)
    .sort();
}

/**
 * Every way the shipped index and the shipped pages can disagree, as lines a
 * human can act on. An empty array is the passing case.
 *
 * `stocks` is the one exemption, and it is a real one rather than a hole: a
 * ruled sheet prints at a second route for A4, deliberately not indexed,
 * because a search that answered "lined paper" with the same sheet twice would
 * be worse at the job. It is exempt only where its Letter twin IS indexed —
 * an orphan `/a4` page with nothing above it is still a problem.
 *
 * @param {{ facets: object, sheets: unknown[][] }} shipped the parsed JSON
 * @param {string[]} built routes found under dist/printables
 * @param {{ sheets: string[], browse: string[], stocks: string[] }} audit
 * @returns {string[]}
 */
export function auditIndex(shipped, built, audit) {
  const problems = [];

  if (built.length === 0) {
    return [
      "No pages were built under /printables at all, so there is nothing to check. Either the catalog stopped emitting routes or this guard is looking in the wrong directory.",
    ];
  }

  const listed = new Set(shipped.sheets.map((row) => String(row[0])));
  const meant = new Set(audit.sheets);
  const pages = new Set(built);

  for (const href of meant) {
    if (!listed.has(href)) {
      problems.push(
        `${href} is in the catalog but not in the index that shipped — the file on disk is not the one this build made.`,
      );
    }
    if (!pages.has(href)) {
      problems.push(
        `${href} is in the search index and no page was built at it. A row that 404s is the catalog advertising paper it hasn't got.`,
      );
    }
  }

  for (const href of listed) {
    if (!meant.has(href)) {
      problems.push(
        `${href} is in the index that shipped and not in the catalog — the file on disk is stale.`,
      );
    }
  }

  const browse = new Set(audit.browse);
  for (const href of built) {
    if (listed.has(href) || browse.has(href)) continue;

    const twin = audit.stocks.some(
      (stock) =>
        href.endsWith(`/${stock}`) &&
        listed.has(href.slice(0, -(stock.length + 1))),
    );
    if (twin) continue;

    problems.push(
      `${href} was built and nothing reaches it — it is in neither the search index nor the list of pages that browse rather than print.`,
    );
  }

  return problems.sort();
}

/**
 * Wired into `astro.config.mjs` after the sitemap guard, for the same reason
 * that one goes after the sitemap: there is nothing to read until the build has
 * written it.
 *
 * @param {{ sheets: string[], browse: string[], stocks: string[] }} audit
 * @returns {import("astro").AstroIntegration}
 */
export function searchIndexGuard(audit) {
  return {
    name: "search-index-guard",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const file = new URL("printables/search-index.json", dir);
        let raw;
        try {
          raw = await readFile(file, "utf8");
        } catch {
          throw new Error(
            `No search index at ${file.pathname}. src/pages/printables/search-index.json.ts did not emit one, so the front door would ship a search box with nothing to search.`,
          );
        }

        const files = await readdir(dir, { recursive: true });
        const problems = auditIndex(
          JSON.parse(raw),
          catalogRoutes(files),
          audit,
        );
        if (problems.length > 0) {
          throw new Error(
            [
              "The search index and the pages in dist/ disagree:",
              ...problems.map((line) => `  · ${line}`),
              "",
              "Both are derived from src/pages/printables/_shelves.ts — see `searchIndex` and `catalogAudit` in _search.ts.",
            ].join("\n"),
          );
        }

        logger.info(
          `search index checked — ${audit.sheets.length} sheets, ${Math.round(raw.length / 102.4) / 10} kB, every one a page that exists`,
        );
      },
    },
  };
}
