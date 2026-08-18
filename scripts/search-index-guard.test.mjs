import { describe, expect, it } from "vitest";

import { auditIndex, catalogRoutes } from "./search-index-guard.mjs";

/**
 * The guard itself is the thing most at risk of rotting into a no-op — a check
 * that always passes is indistinguishable from a check that works, right up
 * until the day it was supposed to fire. So this suite makes it fire, once per
 * way the shop and its index can come apart.
 *
 * The build-time half runs against the directory that actually shipped; this
 * half proves that what it reads it also judges correctly.
 */

const AUDIT = {
  sheets: ["/printables/lined-paper", "/printables/math/addition-worksheets"],
  browse: ["/printables", "/printables/math", "/printables/make"],
  stocks: ["a4"],
};

const index = (...hrefs) => ({
  facets: {},
  sheets: hrefs.map((href) => [href, "A sheet", "Something", "Ages 6–9"]),
});

/** Every route the healthy build writes, including the A4 twin. */
const BUILT = [
  "/printables",
  "/printables/lined-paper",
  "/printables/lined-paper/a4",
  "/printables/make",
  "/printables/math",
  "/printables/math/addition-worksheets",
];

const shipped = index(...AUDIT.sheets);

describe("reading what the build wrote", () => {
  it("turns directory pages into the paths a catalog writes", () => {
    expect(
      catalogRoutes([
        "printables/index.html",
        "printables/lined-paper/index.html",
        "printables/lined-paper/a4/index.html",
        // Not a page, and not ours: only /printables is this guard's business.
        "printables/search-index.json",
        "about/index.html",
      ]),
    ).toEqual([
      "/printables",
      "/printables/lined-paper",
      "/printables/lined-paper/a4",
    ]);
  });
});

describe("auditing the index against dist/", () => {
  it("passes the shop the catalog says it built", () => {
    expect(auditIndex(shipped, BUILT, AUDIT)).toEqual([]);
  });

  it("fails when a sheet in the index has no page", () => {
    // A row that 404s: the catalog advertising paper it hasn't got, which is
    // the failure this whole story is a larger version of.
    const problems = auditIndex(
      shipped,
      BUILT.filter((href) => href !== "/printables/lined-paper"),
      AUDIT,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/printables/lined-paper");
  });

  it("fails when a page was built that nothing reaches", () => {
    // The quiet half. A sheet nobody can find still builds, still deploys and
    // still looks right to everyone who already knows its URL.
    const problems = auditIndex(
      shipped,
      [...BUILT, "/printables/division-worksheets"],
      AUDIT,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/printables/division-worksheets");
  });

  it("fails when the file on disk is not the index this build made", () => {
    const problems = auditIndex(index(AUDIT.sheets[0]), BUILT, AUDIT);
    expect(problems).toHaveLength(2); // missing from the file, and orphaned
    expect(problems.join("\n")).toContain(
      "/printables/math/addition-worksheets",
    );
  });

  it("exempts a second stock only under a sheet that is indexed", () => {
    // Both stocks are real pages; the index lists each sheet once, on the one
    // the hubs link. An /a4 with nothing above it is still an orphan.
    expect(auditIndex(shipped, BUILT, AUDIT)).toEqual([]);

    const problems = auditIndex(
      shipped,
      [...BUILT, "/printables/graph-paper/a4"],
      AUDIT,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/printables/graph-paper/a4");
  });

  it("says so rather than passing when there is nothing to check", () => {
    // The way a directory check rots: a moved output path finds no pages, and
    // an empty loop reports no problems.
    const problems = auditIndex(shipped, [], AUDIT);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("nothing to check");
  });
});
