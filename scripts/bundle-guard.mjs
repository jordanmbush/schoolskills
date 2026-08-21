// @ts-check
import { readFile, readdir } from "node:fs/promises";

/**
 * The build-time check that an island still downloads what it downloaded
 * yesterday.
 *
 * `CORPUS_BAN` in `eslint.config.mjs` exists because one import of the passage
 * library took the shared chunk from 46 KB to 222 KB. That rule bans one known
 * path, which is all a lint rule can do — it cannot name the module nobody has
 * written yet. Meanwhile the Print Shop reached 696 KB with nothing failing.
 * So this is the other half: not "don't import that", but "whatever you do
 * import, the island stays about this size".
 *
 * **Measured as the transitive static import closure from
 * `dist/<route>/index.html`, never the entry chunk.** That distinction is the
 * whole design. Lazy-loading the sheet families (#211) took the Print Shop's
 * entry file from 431,805 B to 66,315 B, an 84.7% fall that was mostly code
 * moving sideways into sibling chunks the entry still imports statically; the
 * closure — what the browser actually fetches before the island renders — went
 * 696,078 B to 340,503 B. A budget on the entry alone would have sat at 66 KB
 * passing while 300 KB grew beside it (docs/printables.md §3).
 *
 * The source-graph twin of this is `src/components/sheet/blocks/index.test.ts`,
 * which walks `src/` and names the import chain that reaches a corpus. Both are
 * wanted: that one says what to do about it, this one catches the byte count
 * however it got there.
 */

/**
 * The React client runtime, given a budget of its own because every island pays
 * for it — 192 KB of the 340 KB the Print Shop fetches, and the same bytes in
 * all of them.
 *
 * It stays inside each island's closure as well, deliberately: what an island
 * costs a parent on a slow connection is what it fetches, not what it fetches
 * minus the parts it shares with a page they haven't opened. This line is what
 * tells you which of the two moved when every figure rises at once.
 *
 * Not a route, so it cannot collide with one — every other key here starts "/".
 */
export const RUNTIME = "react-runtime";

/**
 * How far above the recorded baseline an island may drift before the build
 * fails.
 *
 * Flat rather than a percentage, and this size for a reason at each end. Below
 * it: a feature is a few KB of components, and a guard that fires on those is
 * one people learn to re-record without reading. Above it: what this is here to
 * catch is a data module becoming statically reachable, and the chunks those
 * arrive in start around 10 KB — the word-puzzle family — and run to 173 KB for
 * the passage library. Nothing that matters hides underneath 10 KB.
 */
export const HEADROOM = 10 * 1024;

/**
 * What each island's closure measured when it was last recorded, in bytes.
 *
 * Written down rather than derived, because there is nothing to derive it
 * from: the size an island *ought* to be is a judgement, and this is where the
 * judgement is kept. Re-record a line in the same commit that moves it, and say
 * in the message why the new number is one worth defending.
 *
 * Measured on b44d52d, the commit that lazy-loaded the sheet families. Two
 * thirds of every figure below is `react-runtime`, which is the same bytes in
 * all of them.
 *
 * @type {Record<string, number>}
 */
export const BASELINE = {
  "/flash-cards": 389_189,
  "/printables": 203_902,
  "/printables/make": 340_503,
  "/spelling/play": 389_189,
  "/typing": 410_445,
  [RUNTIME]: 192_242,
};

/** Where a route's HTML lands, with `build.format: "directory"`. */
const PAGE = "index.html";

const bytes = (/** @type {number} */ size) =>
  `${size.toLocaleString("en-US")} B`;

/**
 * The chunks a page hands the browser as its islands: `component-url` is the
 * island itself, `renderer-url` the framework runtime that hydrates it. Astro
 * writes both onto the `<astro-island>` element, so the page that shipped is
 * the thing being read — no manifest, no build metadata, no second opinion.
 *
 * @param {string} html
 * @returns {{ islands: string[], renderers: string[] }} dist-relative URLs
 */
export function islandEntries(html) {
  const urls = (/** @type {string} */ attribute) => [
    ...new Set(
      [...html.matchAll(new RegExp(`${attribute}="([^"]+)"`, "g"))].map(
        (match) => match[1],
      ),
    ),
  ];
  return { islands: urls("component-url"), renderers: urls("renderer-url") };
}

/**
 * The chunks a built chunk pulls in eagerly.
 *
 * Everything here turns on `import(...)` NOT matching. A dynamic import is an
 * expression — `import` followed by a paren — where every static form puts a
 * binding, a `from`, or the quote itself next, so a pattern that demands a
 * quoted specifier after an optional binding clause never reaches past the
 * paren. Vite's own `__vite__mapDeps` table lists its lazy chunks as bare
 * strings (`"_astro/x.js"`) with no `import` in front, and falls out the same
 * way.
 *
 * Line-anchored the way the source walker in
 * `src/components/sheet/blocks/index.test.ts` is, this would find a third of
 * them: Rollup writes one import per line in an entry chunk and packs them onto
 * one line elsewhere. Minified output has no statement layout to lean on.
 *
 * @param {string} source
 * @returns {string[]} specifiers, as written
 */
export function staticImports(source) {
  const star = String.raw`\*\s*(?:as\s+[\w$]+)?`;
  const binding = String.raw`\{[^}]*\}|${star}|[\w$]+(?:\s*,\s*(?:\{[^}]*\}|${star}))?`;
  const statements = new RegExp(
    String.raw`(?:^|[;}\s])(?:import|export)\s*(?:${binding})?\s*(?:from\s*)?"([^"]+)"`,
    "g",
  );
  return [...source.matchAll(statements)].map((match) => match[1]);
}

/**
 * A relative specifier as a dist-relative URL, `..` segments resolved.
 *
 * @param {string} from the importer, as a dist-relative URL
 * @param {string} spec
 * @returns {string}
 */
function resolveChunk(from, spec) {
  const segments = `${from.slice(0, from.lastIndexOf("/"))}/${spec}`.split("/");
  /** @type {string[]} */
  const resolved = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") resolved.pop();
    else resolved.push(segment);
  }
  return `/${resolved.join("/")}`;
}

/**
 * Every chunk reachable from a set of entries by static import, and what they
 * weigh together — the download an island costs before it can render.
 *
 * A chunk two entries share is counted once, which is what makes this a closure
 * rather than a sum: the runtime is in every island's, and adding the islands
 * up would charge for it four times over.
 *
 * `missing` is a specifier that resolved to no chunk. It should always be
 * empty; it is reported rather than skipped because the way a walker like this
 * rots is by quietly following fewer edges than it thinks.
 *
 * @param {string[]} entries dist-relative URLs
 * @param {Map<string, string>} chunks dist-relative URL → source
 * @returns {{ bytes: number, chunks: [string, number][], missing: string[] }}
 */
export function closure(entries, chunks) {
  const seen = new Set();
  const queue = [...entries];
  /** @type {[string, number][]} */
  const found = [];
  /** @type {string[]} */
  const missing = [];

  // Indexed rather than a shift, because the loop appends to what it reads.
  for (let at = 0; at < queue.length; at++) {
    const url = queue[at];
    if (seen.has(url)) continue;
    seen.add(url);

    const source = chunks.get(url);
    if (source === undefined) {
      missing.push(url);
      continue;
    }
    found.push([url, Buffer.byteLength(source)]);

    for (const spec of staticImports(source)) {
      if (spec.startsWith(".")) queue.push(resolveChunk(url, spec));
    }
  }

  found.sort((a, b) => b[1] - a[1]);
  return {
    bytes: found.reduce((sum, [, size]) => sum + size, 0),
    chunks: found,
    missing,
  };
}

/**
 * Every way the islands that shipped and the budgets recorded for them can
 * disagree, as lines a human can act on. An empty array is the passing case.
 *
 * It fails in both directions, deliberately. Over budget is the regression
 * everyone expects. Under the baseline by more than the headroom is a win
 * nobody wrote down, and a baseline sitting 40 KB above what the island ships
 * is a budget that has quietly stopped guarding 40 KB.
 *
 * @param {Map<string, ReturnType<typeof closure>>} measured
 * @param {Record<string, number>} baseline
 * @param {number} headroom
 * @returns {string[]}
 */
export function auditBundles(measured, baseline, headroom) {
  if (measured.size === 0) {
    return [
      "No islands were found in dist/ at all, so there is nothing to weigh. Either the pages stopped mounting one or this guard is reading the wrong directory.",
    ];
  }

  /** @type {string[]} */
  const problems = [];

  for (const [name, { bytes: size, chunks, missing }] of measured) {
    if (missing.length > 0) {
      problems.push(
        `${name} imports ${missing.join(", ")} and no such chunk was built, so this walk followed fewer edges than the browser will and every figure for it is an undercount.`,
      );
    }

    const recorded = baseline[name];
    if (recorded === undefined) {
      problems.push(
        `${name} is an island with no budget recorded. It fetches ${bytes(size)} today — put that in BASELINE in scripts/bundle-guard.mjs, once satisfied it is a number worth defending.`,
      );
      continue;
    }

    const budget = recorded + headroom;
    if (size > budget) {
      const largest = chunks
        .slice(0, 3)
        .map(([url, chunk]) => `${url.split("/").pop()} ${bytes(chunk)}`)
        .join(", ");
      problems.push(
        `${name} fetches ${bytes(size)} before it renders — ${bytes(size - budget)} over its budget of ${bytes(budget)} (${bytes(recorded)} recorded, ${bytes(headroom)} headroom). Its closure is ${chunks.length} chunks; the largest are ${largest}.`,
      );
    } else if (size < recorded - headroom) {
      problems.push(
        `${name} fetches ${bytes(size)}, which is ${bytes(recorded - size)} under the ${bytes(recorded)} recorded for it. Record the win — until you do, the budget above it is that much looser than it reads.`,
      );
    }
  }

  for (const name of Object.keys(baseline)) {
    if (!measured.has(name)) {
      problems.push(
        `${name} has a budget recorded and nothing was measured against it — no island was built at that route, so the line guards nothing.`,
      );
    }
  }

  return problems.sort();
}

/**
 * Wired into `astro.config.mjs` after the other two `astro:build:done` guards,
 * for the reason they go where they go: there is nothing to weigh until the
 * build has written it.
 *
 * @returns {import("astro").AstroIntegration}
 */
export function bundleGuard() {
  return {
    name: "bundle-guard",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const files = await readdir(dir, { recursive: true });
        const read = (/** @type {string} */ file) =>
          readFile(new URL(file, dir), "utf8");

        /** @type {Map<string, string>} */
        const chunks = new Map();
        await Promise.all(
          files
            .filter((file) => file.endsWith(".js"))
            .map(async (file) => {
              chunks.set(`/${file}`, await read(file));
            }),
        );

        /** @type {Map<string, ReturnType<typeof closure>>} */
        const measured = new Map();
        /** @type {Set<string>} */
        const renderers = new Set();
        for (const file of files.filter((file) => file.endsWith(PAGE))) {
          const { islands, renderers: used } = islandEntries(await read(file));
          if (islands.length === 0) continue;
          measured.set(
            `/${file.slice(0, -(PAGE.length + 1))}`,
            closure([...islands, ...used], chunks),
          );
          for (const url of used) renderers.add(url);
        }
        if (renderers.size > 0) {
          measured.set(RUNTIME, closure([...renderers], chunks));
        }

        const problems = auditBundles(measured, BASELINE, HEADROOM);
        if (problems.length > 0) {
          throw new Error(
            [
              "Island bundle budgets and dist/ disagree:",
              ...problems.map((line) => `  · ${line}`),
              "",
              "Every figure is the transitive STATIC import closure from dist/<route>/index.html — each chunk the browser fetches before the island renders, not the entry file. A step change is almost always a data module that has become statically reachable: a sheet family or a corpus pulled in by a component, whose `() => import(...)` then resolves out of memory instead of fetching. src/components/sheet/blocks/index.test.ts names the import chain when the leak starts under src/components/sheet/ (docs/printables.md §3).",
            ].join("\n"),
          );
        }

        const spare = (
          /** @type {[string, ReturnType<typeof closure>]} */ [name, walked],
        ) => BASELINE[name] + HEADROOM - walked.bytes;
        const tightest = [...measured].sort((a, b) => spare(a) - spare(b))[0];
        logger.info(
          `bundle budgets checked — ${measured.size - 1} islands and the runtime, tightest is ${tightest[0]} with ${bytes(spare(tightest))} to spare`,
        );
      },
    },
  };
}
