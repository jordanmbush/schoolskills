import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The block renderers draw a block. They never reach the family that made one.
 *
 * `Sheet.tsx` and its blocks ship inside the Print Shop's first download, and
 * `families.ts` keeps twenty-seven corpora out of that download only while
 * nothing static points at them (§3). A renderer that imports one helper from
 * `words/puzzles.ts` puts the whole puzzle generator back in the island, and
 * the family's `() => import(...)` then "fetches" a module the browser already
 * had — a regression that is invisible in review, because the import reads like
 * any other and the loader still looks lazy from the registry's side.
 *
 * So this walks the static import graph out of `src/components/sheet/` and
 * fails if it reaches a family module or a corpus, naming the chain that got
 * there. The cure is always the same one MF1 and MF2 took: put the pure helper
 * in a leaf of its own — `phonics/metrics.ts`, `words/metrics.ts` — and import
 * that instead.
 *
 * Type-only imports are erased before the bundler sees them, so they cost
 * nothing and are skipped here.
 *
 * A source graph, not the built one: it names the offending import, where
 * `scripts/bundle-guard.mjs` catches the byte count in `dist/` however it got
 * there. Both are wanted, and this is the half that can say what to do about
 * it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../../..");
const SHEETS = join(SRC, "engine/sheets");

/** Every source file under a directory, tests excluded — they don't ship. */
function sourcesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourcesIn(path);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name))
      return [];
    return [path];
  });
}

/**
 * The specifiers a module pulls in eagerly.
 *
 * Statements only, which is what makes `import(...)` fall out for free: a
 * dynamic import is an expression, and never starts a line with `import` or
 * `export`. `import type` goes the same way, deliberately.
 */
function staticImports(source: string): string[] {
  const statements = source.matchAll(
    /^(?:import|export)\b[^"';]*?from\s*["']([^"']+)["']|^import\s*["']([^"']+)["']/gm,
  );
  return [...statements]
    .filter((match) => !/^(?:import|export)\s+type\b/.test(match[0]))
    .map((match) => match[1] ?? match[2]);
}

/** Where a specifier lands on disk, or null for a package we don't own. */
function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null;
  if (base === null) return null;
  const tries = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
  return tries.find((path) => /\.tsx?$/.test(path) && exists(path)) ?? null;
}

const exists = (path: string): boolean => {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
};

/** The twenty-seven, read out of the registry so the list can't drift. */
function familyModules(): string[] {
  const registry = readFileSync(join(SHEETS, "families.ts"), "utf8");
  return [...registry.matchAll(/import\("\.\/([^"]+)"\)/g)].map((match) =>
    join(SHEETS, `${match[1]}.ts`),
  );
}

const BANNED = new Map<string, string>([
  // The eager door: it awaits every family at module load, for the catalog
  // build and the tests. Nothing that reaches a browser may import it.
  [join(SHEETS, "index.ts"), "awaits every family at module load"],
  ...familyModules().map(
    (path) =>
      [path, "a sheet family — it must stay behind its loader"] as const,
  ),
  // The corpora the issue named. A family module is the usual way in, but
  // `phonics/cards.ts` was the way MF1 got there, and it is not a family.
  ...(
    [
      "passages/scripture.ts",
      "passages/kjv.ts",
      "phonics/bank.ts",
      "grammar/bank.ts",
      "words/bank.ts",
    ] as const
  ).map((path) => [join(SHEETS, path), "a corpus"] as const),
]);

/** The chain from a renderer to something banned, or null if there is none. */
function chainToBanned(root: string): string[] | null {
  const seen = new Set([root]);
  const queue: string[][] = [[root]];
  while (queue.length > 0) {
    const chain = queue.shift() as string[];
    const at = chain[chain.length - 1];
    if (BANNED.has(at)) return chain;
    for (const spec of staticImports(readFileSync(at, "utf8"))) {
      const next = resolveImport(at, spec);
      if (next === null || seen.has(next)) continue;
      seen.add(next);
      queue.push([...chain, next]);
    }
  }
  return null;
}

describe("the sheet view's import graph", () => {
  it.each(
    sourcesIn(join(SRC, "components/sheet")).map((path) => [
      relative(SRC, path),
    ]),
  )("%s reaches no sheet family and no corpus", (root: string) => {
    const chain = chainToBanned(join(SRC, root));
    const why = chain ? BANNED.get(chain[chain.length - 1]) : "";
    expect(
      chain?.map((path) => relative(SRC, path)).join("\n  → ") ?? null,
      `that last module is ${why}`,
    ).toBeNull();
  });
});
