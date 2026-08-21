import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SHEET_FAMILIES } from "./families";

/**
 * Every family in the registry is held to the contract (§20).
 *
 * `contract.ts` is only worth having if a family cannot quietly skip it, and a
 * shared helper is exactly the kind of thing an author of the twenty-eighth
 * family never hears about: their suite passes, the catalog builds, and the
 * assertions the other twenty-seven keep are simply never made about theirs.
 *
 * So the list comes out of `families.ts` rather than being written here. A
 * hard-coded twenty-seven names would stop covering a family the day somebody
 * added one, which is the day it matters. Same reason the import-graph guard in
 * `src/components/sheet/blocks/` reads the registry rather than a list of its
 * own.
 *
 * A source scan and not a registration hook: vitest gives each test file its own
 * module graph, so a set filled in by `describeSheetFamily` at import time would
 * only ever hold the one family whose suite happened to be running.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every suite under the sheet layer, this guard excepted — see `covered`. */
function suitesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return suitesIn(path);
    return /\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

/**
 * The kind each suite runs the contract on, and which suite runs it.
 *
 * This file is left out of the walk deliberately: the failure message below
 * quotes the call a suite is missing, `${id}` and all, so a scan that read this
 * file would take that literal `${id}` for a covered kind, and the stray-kind
 * test would fail on it.
 */
function covered(): Map<string, string> {
  const found = new Map<string, string>();
  for (const path of suitesIn(HERE)) {
    if (path === fileURLToPath(import.meta.url)) continue;
    const source = readFileSync(path, "utf8");
    for (const [, kind] of source.matchAll(
      /describeSheetFamily\(\s*"([^"]+)"/g,
    )) {
      found.set(kind, relative(HERE, path));
    }
  }
  return found;
}

const COVERED = covered();

describe("the sheet-family contract", () => {
  it.each(SHEET_FAMILIES.map((family) => [family.id]))(
    "is kept by the %s family",
    (id: string) => {
      expect(
        COVERED.get(id) ?? null,
        `no suite calls describeSheetFamily("${id}", …). Add it to that family's test file — the nine clauses in contract.ts are what every other family is held to, and a family added to families.ts without them is checked by nothing they cover.`,
      ).not.toBeNull();
    },
  );

  it("is not run against a kind this build does not make", () => {
    // A mistyped kind would otherwise fail as "sheetSpec is UNKNOWN_SHEET",
    // which reads like a broken loader rather than like a typo in a test.
    const registry = new Set(SHEET_FAMILIES.map((family) => family.id));
    const strays = [...COVERED].filter(([kind]) => !registry.has(kind));
    expect(
      strays.map(([kind, suite]) => `"${kind}" in ${suite}`),
      "a suite runs the contract on a kind families.ts has never heard of",
    ).toEqual([]);
  });
});
