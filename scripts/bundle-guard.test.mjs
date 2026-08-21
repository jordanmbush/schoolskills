import { describe, expect, it } from "vitest";

import {
  auditBundles,
  closure,
  islandEntries,
  staticImports,
} from "./bundle-guard.mjs";

/**
 * A budget nobody has watched fail is a budget nobody knows works, and this one
 * has two ways to be wrong that both look exactly like passing: reading the
 * entry chunk instead of the closure, and counting a lazy chunk as though it
 * were eager. So the walker is exercised on output shaped like Rollup's, and
 * the audit is made to fire once per way an island and its budget can part.
 *
 * The build-time half runs against the chunks that actually shipped; this half
 * proves that what it reads it also adds up correctly.
 */

/** One island, one runtime, on the element Astro writes. */
const HTML = `<astro-island uid="a1" component-url="/_astro/App.aaa.js"
  component-export="default" renderer-url="/_astro/client.bbb.js"
  props="{}" ssr client="only"></astro-island>`;

const chunk = (bytes) => "x".repeat(bytes);

describe("reading the entries off a page", () => {
  it("takes the island and its renderer", () => {
    expect(islandEntries(HTML)).toEqual({
      islands: ["/_astro/App.aaa.js"],
      renderers: ["/_astro/client.bbb.js"],
    });
  });

  it("counts a chunk once when two islands share it", () => {
    expect(islandEntries(HTML + HTML).renderers).toEqual([
      "/_astro/client.bbb.js",
    ]);
  });

  it("finds nothing on a page that mounts nothing", () => {
    expect(islandEntries("<p>A worksheet, prerendered.</p>")).toEqual({
      islands: [],
      renderers: [],
    });
  });
});

describe("telling a static import from a lazy one", () => {
  it("takes every static form Rollup writes", () => {
    // All on one line, as a minified chunk has them: the statement layout an
    // anchored pattern would need is only there in an entry chunk.
    const source =
      'import{a as b,c}from"./records.aaa.js";import"./side-effect.bbb.js";' +
      'export*from"./words.ccc.js";export{d}from"./kit.ddd.js";' +
      'import e,{f}from"./react.eee.js";import*as g from"./paper.fff.js"';
    expect(staticImports(source)).toEqual([
      "./records.aaa.js",
      "./side-effect.bbb.js",
      "./words.ccc.js",
      "./kit.ddd.js",
      "./react.eee.js",
      "./paper.fff.js",
    ]);
  });

  it("leaves a dynamic import out, and Vite's table of them with it", () => {
    // The whole point of the guard: `() => import(...)` is a fetch the browser
    // makes later, if ever. Counting it would put all twenty-seven sheet
    // families back in the Print Shop's budget and hide the regression the
    // budget exists to catch.
    const source =
      'const __vite__mapDeps=(i,m=m.f||(m.f=["_astro/copywork.aaa.js"]))=>i.map(i=>m.f[i]);' +
      'import{p}from"./real.bbb.js";' +
      'const load=()=>__vitePreload(()=>import("./copywork.aaa.js"),__vite__mapDeps([0]))';
    expect(staticImports(source)).toEqual(["./real.bbb.js"]);
  });
});

describe("walking the closure", () => {
  const CHUNKS = new Map([
    ["/_astro/App.aaa.js", `import{a}from"./shared.ccc.js";${chunk(1_000)}`],
    ["/_astro/client.bbb.js", `import"./shared.ccc.js";${chunk(2_000)}`],
    ["/_astro/shared.ccc.js", `import"../vendor/deep.ddd.js";${chunk(500)}`],
    ["/vendor/deep.ddd.js", chunk(300)],
    ["/_astro/lazy.eee.js", chunk(9_000)],
  ]);

  it("sums every chunk reachable from the entries, each one once", () => {
    const walked = closure(
      ["/_astro/App.aaa.js", "/_astro/client.bbb.js"],
      CHUNKS,
    );
    // 1,000 + 2,000 + 500 + 300, plus the import statements' own bytes. The
    // shared chunk is in both entries' graphs and is paid for once.
    expect(walked.chunks).toHaveLength(4);
    expect(walked.bytes).toBe(
      [...CHUNKS]
        .filter(([url]) => url !== "/_astro/lazy.eee.js")
        .reduce((sum, [, source]) => sum + source.length, 0),
    );
    expect(walked.missing).toEqual([]);
  });

  it("puts the largest chunk first, since that is the one to look at", () => {
    const walked = closure(["/_astro/App.aaa.js"], CHUNKS);
    expect(walked.chunks[0][0]).toBe("/_astro/App.aaa.js");
  });

  it("reports a specifier that resolves to no chunk rather than skipping it", () => {
    // How a walker like this rots: it follows fewer edges than the browser
    // does, and every number it reports is quietly an undercount.
    expect(closure(["/_astro/App.aaa.js"], new Map()).missing).toEqual([
      "/_astro/App.aaa.js",
    ]);
  });
});

describe("auditing the closures against the budgets", () => {
  const HEADROOM = 10_240;
  const BASELINE = { "/typing": 400_000, "react-runtime": 190_000 };
  const weigh = (bytes, chunks) => ({
    bytes,
    chunks: chunks ?? [["/_astro/App.aaa.js", bytes]],
    missing: [],
  });
  const shipped = (bytes, chunks) =>
    new Map([
      ["/typing", weigh(bytes, chunks)],
      ["react-runtime", weigh(190_000)],
    ]);

  it("passes an island sitting on its baseline", () => {
    expect(auditBundles(shipped(400_000), BASELINE, HEADROOM)).toEqual([]);
  });

  it("passes a drift inside the headroom", () => {
    expect(auditBundles(shipped(410_240), BASELINE, HEADROOM)).toEqual([]);
  });

  it("names the island, the budget, the size and the chunks over budget", () => {
    const problems = auditBundles(
      shipped(584_000, [
        ["/_astro/copywork.aaa.js", 173_202],
        ["/_astro/App.aaa.js", 79_359],
      ]),
      BASELINE,
      HEADROOM,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/typing");
    expect(problems[0]).toContain("584,000 B"); // what it ships
    expect(problems[0]).toContain("410,240 B"); // what it may ship
    expect(problems[0]).toContain("173,760 B"); // by how much it is over
    expect(problems[0]).toContain("copywork.aaa.js 173,202 B"); // the likely cause
  });

  it("fails a win nobody recorded, so the budget cannot go slack", () => {
    const problems = auditBundles(shipped(300_000), BASELINE, HEADROOM);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("100,000 B under");
  });

  it("fails an island with no budget written down", () => {
    const problems = auditBundles(
      new Map([...shipped(400_000), ["/new-game", weigh(500_000)]]),
      BASELINE,
      HEADROOM,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/new-game");
    expect(problems[0]).toContain("no budget recorded");
  });

  it("fails a budget with no island left under it", () => {
    // The stale half: a route moves, its line stays, and it guards nothing
    // while still reading like a guard.
    const problems = auditBundles(
      new Map([["react-runtime", weigh(190_000)]]),
      BASELINE,
      HEADROOM,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/typing");
    expect(problems[0]).toContain("guards nothing");
  });

  it("reports an undercount rather than judging one", () => {
    const problems = auditBundles(
      new Map([
        ["/typing", { bytes: 400_000, chunks: [], missing: ["/_astro/x.js"] }],
        ["react-runtime", weigh(190_000)],
      ]),
      BASELINE,
      HEADROOM,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("undercount");
  });

  it("says so rather than passing when there is nothing to weigh", () => {
    // The way a directory check rots: a moved output path finds no islands,
    // and an empty loop reports no problems.
    const problems = auditBundles(new Map(), BASELINE, HEADROOM);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("nothing to weigh");
  });
});
