import { describe, expect, it } from "vitest";

import { WORLDS } from "../src/engine/worlds";
import { auditSitemap, locations } from "./sitemap-guard.mjs";

/**
 * The guard itself is the thing most at risk of rotting into a no-op — a check
 * that always passes is indistinguishable from a check that works, right up
 * until the day it was supposed to fire. So this suite makes it fire.
 *
 * The build-time half lives in scripts/sitemap-guard.mjs and runs against the
 * file that actually shipped; this half proves that what it reads it also
 * judges correctly.
 */

const sitemap = (...paths) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset>${paths
    .map((path) => `<loc>https://schoolskills.app${path}</loc>`)
    .join("")}</urlset>`;

/** Everything the registry says must be crawlable, and nothing it doesn't. */
const healthy = sitemap(
  "/",
  ...WORLDS.flatMap((world) => [
    ...(world.href === world.island ? [] : [`${world.href}/`]),
    ...(world.guide ? [`${world.guide.href}/`] : []),
  ]),
);

describe("reading a sitemap", () => {
  it("compares like an href, not like a URL", () => {
    // Astro writes absolute URLs with a trailing slash; a world's href has
    // neither. Comparing the two raw is the bug this normalisation prevents.
    expect(locations(sitemap("/printables/", "/spelling/"))).toEqual(
      new Set(["/printables", "/spelling"]),
    );
  });
});

describe("auditing it against the world registry", () => {
  it("passes the sitemap the site is meant to ship", () => {
    expect(auditSitemap(healthy, WORLDS)).toEqual([]);
  });

  it("fails when a world's island is submitted", () => {
    // Every island carries `noindex`. Listing one is asking Google to crawl a
    // page we have told it to ignore.
    const problems = auditSitemap(
      sitemap(...[...locations(healthy)], "/printables/make/"),
      WORLDS,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/printables/make");
  });

  it("fails when a world's crawlable front door is missing", () => {
    // The Print Shop's catalog is the case this whole guard exists for: it
    // vanishes from the sitemap without breaking the build, the deploy, or the
    // look of a single page.
    const problems = auditSitemap(
      sitemap(...[...locations(healthy)].filter((p) => p !== "/printables")),
      WORLDS,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/printables");
  });

  it("fails when a world's guide is missing", () => {
    const problems = auditSitemap(
      sitemap(...[...locations(healthy)].filter((p) => p !== "/spelling")),
      WORLDS,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/spelling");
  });

  it("expects nothing crawlable of a world whose front door IS its island", () => {
    // /flash-cards is both, and correctly absent from the sitemap. A rule that
    // treated every `href` as crawlable would demand it back and fail here.
    expect([...locations(healthy)]).not.toContain("/flash-cards");
    expect(auditSitemap(healthy, WORLDS)).toEqual([]);
  });
});
