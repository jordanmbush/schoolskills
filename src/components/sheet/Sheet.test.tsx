import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_PAPER } from "@/engine/sheets/paper";
import type { Block, Sheet } from "@/engine/sheets/types";

import { SheetView } from "./Sheet";

/**
 * The properties a printable sheet lives or dies by.
 *
 * Three of them can't be seen by looking at a screen, which is why they are
 * tested rather than reviewed:
 *
 * **It prints.** Browsers drop background paint unless the reader has ticked
 * "Background graphics", so a ruling drawn with `repeating-linear-gradient`
 * looks perfect in a preview and comes out of the printer blank. Only strokes
 * and borders are foreground.
 *
 * **It ships no JavaScript.** That is the whole SEO argument (§2), and it holds
 * only while every renderer is prop-driven — the moment one needs a hook, the
 * catalog page needs `client:*` and the page becomes an app.
 *
 * **No advertising is inside the printable region** (§10). A slot beside a
 * sheet is fine; a slot inside one prints.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/* ── Fixtures ──────────────────────────────────────────────────────────────
   One block of every kind in the union, so a renderer that throws on a shape
   the engine can legally produce fails here rather than on a catalog page.  */

const EVERY_BLOCK: Block[] = [
  {
    kind: "problems",
    columns: 3,
    items: [
      { prompt: "7 × 8 =", answer: "56", factId: "7:8" },
      { prompt: "6 × 9 =", answer: "54", workspace: 500 },
    ],
  },
  { kind: "rules", rule: { style: "hand-5-8", descender: true }, lines: 6 },
  { kind: "rules", rule: { style: "college" }, lines: 4 },
  { kind: "rules", rule: { style: "graph" }, lines: 8 },
  { kind: "rules", rule: { style: "dot" }, lines: 8 },
  { kind: "rules", rule: { style: "isometric" }, lines: 8 },
  { kind: "rules", rule: { style: "blank" }, lines: 4 },
  {
    kind: "trace",
    rule: { style: "hand-1", midline: "dashed" },
    rows: [{ text: "cat", repeats: ["solid", "dotted", "dashed", "none"] }],
  },
  {
    kind: "copywork",
    text: "The quick brown fox\njumps over the lazy dog",
    rule: { style: "hand-1-2" },
    mode: "dim",
  },
  {
    kind: "grid",
    grid: {
      kind: "coordinate",
      columns: 4,
      rows: 4,
      cell: 250,
      cells: ["1", "2", "", "4"],
      origin: { column: 2, row: 2 },
    },
  },
  {
    kind: "wordsearch",
    letters: [
      ["c", "a", "t"],
      ["x", "y", "z"],
      ["d", "o", "g"],
    ],
    find: ["cat", "dog"],
    solution: [{ word: "cat", column: 0, row: 0, dx: 1, dy: 0 }],
  },
  {
    kind: "matching",
    left: ["one", "two"],
    right: ["uno", "dos"],
    answer: [0, 1],
  },
  {
    kind: "blanks",
    sentences: [{ text: "The __ sat on the __.", answers: ["cat", "mat"] }],
  },
  {
    kind: "choice",
    questions: [
      { prompt: "How many legs?", options: ["two", "four"], answer: 1 },
    ],
  },
  {
    kind: "clock",
    faces: [
      { hour: 3, minute: 20, hands: true, label: "A" },
      { hour: 9, minute: 45, hands: false },
    ],
  },
  {
    kind: "shapes",
    figures: [
      {
        shape: "rectangle",
        points: [
          { x: 0, y: 0 },
          { x: 800, y: 0 },
          { x: 800, y: 500 },
          { x: 0, y: 500 },
        ],
        labels: ["8 cm", "5 cm"],
      },
      {
        shape: "circle",
        points: [
          { x: 400, y: 400 },
          { x: 700, y: 400 },
        ],
      },
    ],
  },
  { kind: "cutline" },
  { kind: "spacer", height: 1200 },
];

const sheet = (over: Partial<Sheet> = {}): Sheet => ({
  paper: DEFAULT_PAPER,
  fontPt: 12,
  header: {
    title: "Times tables",
    instructions: "Work down each column.",
    fields: ["name", "date"],
    score: { outOf: 20 },
  },
  blocks: EVERY_BLOCK,
  footer: {
    credit: "Free printables and learning games",
    url: "schoolskills.app",
    seed: 4242,
  },
  answers: false,
  ...over,
});

const render = (value: Sheet = sheet()) =>
  renderToStaticMarkup(<SheetView sheet={value} />);

/** Every file under `dir` whose name ends in one of `endings`. */
function filesUnder(dir: string, endings: string[]): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path, endings);
    return endings.some((end) => entry.name.endsWith(end)) ? [path] : [];
  });
}

const read = (path: string) => readFileSync(path, "utf8");

/* ── The blocks ────────────────────────────────────────────────────────── */

describe("rendering a sheet", () => {
  it("draws every kind of block the engine can produce", () => {
    const html = render();
    for (const block of EVERY_BLOCK) {
      expect(() =>
        renderToStaticMarkup(<SheetView sheet={sheet({ blocks: [block] })} />),
      ).not.toThrow();
    }
    expect(html).toContain('class="sheet"');
    expect(html).toContain("Times tables");
    expect(html).toContain("schoolskills.app");
    expect(html).toContain("#4242");
  });

  it("keeps the problems as real text, not as a picture of text", () => {
    // Half of §2: the problems on a multiplication sheet are content a crawler
    // reads and a parent can select. A canvas would rank for nothing.
    expect(render()).toContain("7 × 8 =");
  });

  it("prints the name line blank", () => {
    // §1. There is nowhere in a config for a child's name, and this is the
    // component that would otherwise be the place it leaked out.
    const html = render();
    expect(html).toContain("Name");
    expect(html).toContain("sheet__field-rule");
  });

  it("prints the answers only when the sheet says so", () => {
    expect(render()).not.toContain(">56<");
    const key = render(sheet({ answers: true }));
    expect(key).toContain(">56<");
    expect(key).toContain('data-answers="true"');
  });

  it("sizes the page in inches, from the paper the sheet was built on", () => {
    expect(render()).toContain("--sheet-w:8.5in");
    const a4 = render(
      sheet({
        paper: { size: "a4", orientation: "landscape", margin: "narrow" },
      }),
    );
    // A4 landscape is 11.693in × 8.268in, and it has to say so in `@page` —
    // print is the whole output path, so a page box that disagrees with the
    // sheet on it prints scaled or across two pages (§10).
    expect(a4).toContain("--sheet-w:11.693in");
    expect(a4).toContain("@page{size:11.693in 8.268in;margin:0}");
  });
});

/* ── It has to survive the printer ─────────────────────────────────────── */

describe("ruled blocks", () => {
  it("draws rules as <svg> <line>, never as a background image", () => {
    const html = render(
      sheet({ blocks: [{ kind: "rules", rule: { style: "wide" }, lines: 5 }] }),
    );
    expect(html).toContain("<svg");
    expect(html).toContain("<line");
    expect(html).not.toContain("repeating-linear-gradient");
    expect(html).not.toContain("background");
  });

  it("draws a dot grid with lines too, rather than a thousand circles", () => {
    // A zero-length dash with a round cap is a dot. One <line> per row instead
    // of one element per intersection, and the two print identically.
    const html = render(
      sheet({ blocks: [{ kind: "rules", rule: { style: "dot" }, lines: 20 }] }),
    );
    expect(html).toContain('stroke-dasharray="0 250"');
    expect(html).not.toContain("<circle");
  });

  it("never reaches for a gradient anywhere in the sheet's own styles", () => {
    // The obvious implementation, and the one that prints blank.
    for (const file of ["sheet.css", "print.css"]) {
      expect(read(join(ROOT, "src/styles", file))).not.toContain(
        "repeating-linear-gradient",
      );
    }
  });
});

/* ── Print isolation (§20) ─────────────────────────────────────────────── */

describe("print isolation", () => {
  it("never puts an ad inside a sheet", () => {
    expect(render()).not.toMatch(/class="[^"]*\bad\b[^"]*"/);
  });

  it("has no renderer that could put one there", () => {
    // The rendered markup only proves it for the blocks this fixture holds.
    // The source proves it for every sheet anybody builds later.
    for (const file of filesUnder(HERE, [".tsx", ".ts"])) {
      if (file.endsWith(".test.tsx")) continue;
      expect(read(file)).not.toMatch(/AdSlot|adsbygoogle|"ad[ "]/);
    }
  });

  it("hides the site, the ad slots and the builder's controls when printing", () => {
    const css = read(join(ROOT, "src/styles/print.css"));
    const print = css.slice(css.indexOf("@media print"));
    for (const hidden of [".mast", ".foot", ".skip", ".ad", ".no-print"]) {
      expect(print).toContain(hidden);
    }
    expect(css).toMatch(/@page\s*\{[^}]*size:/);
    expect(css).toMatch(/@page\s*\{[^}]*margin:\s*0/);
  });

  it("breaks pages where a reader would expect it to", () => {
    const css = read(join(ROOT, "src/styles/sheet.css"));
    expect(css).toContain("break-after: page");
    expect(css).toContain("break-inside: avoid");
  });

  it("takes the sheet out of the app's scale, rather than inheriting it", () => {
    // §4: a ⅝ rule is ⅝ of an inch or it is wrong. `--ui-scale` grows every
    // size on the site with the player's age, and paper must not do that.
    const css = read(join(ROOT, "src/styles/sheet.css"));
    const rule = css.slice(css.indexOf(".sheet {"), css.indexOf("}"));
    expect(rule).toContain("--ui-scale: 1");
  });
});

/* ── Zero JavaScript ───────────────────────────────────────────────────── */

describe("the zero-JavaScript property", () => {
  it("renders to markup with nothing to run in it", () => {
    const html = render();
    expect(html).not.toContain("<script");
    expect(html).not.toContain("astro-island");
    // A handler attribute is the tell that a renderer wanted to be an app.
    expect(html).not.toMatch(/\son[a-z]+="/);
  });

  it("has no renderer that would need hydrating", () => {
    // The issue's own note: if a renderer needs a hook, it belongs in the
    // builder, not here. A hook is also exactly what forces `client:*` onto a
    // catalog page, which is what would cost the section its SEO argument.
    for (const file of filesUnder(HERE, [".tsx", ".ts"])) {
      if (file.endsWith(".test.tsx")) continue;
      expect(read(file)).not.toMatch(
        /\buse(State|Effect|Ref|Reducer|Context|Memo|Callback|Id|SyncExternalStore)\b/,
      );
      expect(read(file)).not.toContain("react-dom/client");
    }
  });

  it("is never mounted with a client directive by a page", () => {
    const pages = filesUnder(join(ROOT, "src/pages"), [".astro"]).concat(
      filesUnder(join(ROOT, "src/layouts"), [".astro"]),
    );
    for (const page of pages) {
      const source = read(page);
      if (!source.includes("components/sheet")) continue;
      expect(source).not.toMatch(/<Sheet[A-Za-z]*[^>]*\sclient:/);
    }
  });

  /*
   * The same property, against the built output.
   *
   * Two things would show up in `dist/` if a sheet were ever hydrated: an
   * `<astro-island>` naming the renderer, and the renderer's own class names
   * inside a JavaScript chunk. Neither is there while every mount is
   * directive-free — which is the point, and is why this passes before the
   * first catalog page exists and keeps passing after PRINT03 adds one.
   */
  it("ships no sheet renderer in the built JavaScript", () => {
    const dist = join(ROOT, "dist");
    if (!existsSync(dist)) return; // `npm run build` hasn't run yet.

    for (const script of filesUnder(join(dist, "_astro"), [".js"])) {
      expect(read(script)).not.toContain("sheet__glyph");
      expect(read(script)).not.toContain("sheet__blocks");
    }
    for (const page of filesUnder(dist, [".html"])) {
      const html = read(page);
      if (!/class="[^"]*\bsheet\b/.test(html)) continue;
      expect(html).not.toContain("astro-island");
    }
  });
});
