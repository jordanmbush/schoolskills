import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  FACES,
  MAX_OUTLINE,
  MIN_INK,
  faceOf,
  fittedEm,
  glyphEm,
  traceInk,
} from "./faces";
import { RULINGS, rulePitch, ruleLines } from "./paper";
import type { Rule, RuleStyle, SheetFont } from "./types";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

/** Every ruling a child is asked to write between, with and without tails. */
const HANDWRITING = Object.values(RULINGS)
  .filter((ruling) => ruling.handwriting)
  .flatMap((ruling): Rule[] => [
    { style: ruling.id, descender: false },
    { style: ruling.id, descender: true },
  ]);

/** The writing space of a rule: the top line down to the baseline. */
function writingSpace(rule: Rule): number {
  const lines = ruleLines(rule);
  const base =
    lines.find((line) => line.role === "base")?.at ?? rulePitch(rule);
  const top = lines.find((line) => line.role === "top")?.at ?? 0;
  return base - top;
}

describe("resolving a face", () => {
  it("answers with the face that was asked for", () => {
    for (const id of Object.keys(FACES) as SheetFont[]) {
      expect(faceOf(id).id).toBe(id);
    }
  });

  it("falls back to print for a face that isn't there", () => {
    // Absent is the print face by definition, and a sheet saved before a face
    // was renamed must still print rather than throw. `toString` is the shape
    // of that hazard `own` exists for: a `??` would hand back a function.
    expect(faceOf(undefined).id).toBe("print");
    expect(faceOf("comic" as SheetFont).id).toBe("print");
    expect(faceOf("toString" as SheetFont).id).toBe("print");
  });
});

describe("sizing letters to a ruling", () => {
  it("puts the tallest letter on the top line, in every face", () => {
    // The whole reason the proportions are measured rather than shared: the
    // same rule holds a different em in each of the three, and a capital that
    // misses the top line by a tenth is what a teacher notices first.
    for (const face of Object.values(FACES)) {
      for (const rule of HANDWRITING) {
        const writing = writingSpace(rule);
        const em = glyphEm(writing, face);
        expect(Math.abs(em * face.ascent - writing), face.family) //
          .toBeLessThanOrEqual(1);
      }
    }
  });

  it("puts a letter body over the midline, never under it", () => {
    // The midline sits at exactly half the writing space, and it is the line a
    // child is told to write their letter bodies up to. The em is fixed to the
    // top line, so the midline can only follow from it — what is asserted here
    // is the direction of the miss and its size. Over the line, so there is
    // always a line to write up to; a model that stopped short would be
    // teaching them to ignore it. And by no more than a sixth of the writing
    // space, which is as far as a body can rise before the midline reads as
    // decoration rather than as the guide it is.
    for (const face of Object.values(FACES)) {
      for (const rule of HANDWRITING) {
        const writing = writingSpace(rule);
        const over = glyphEm(writing, face) * face.xHeight - writing / 2;
        expect(over, face.family).toBeGreaterThanOrEqual(0);
        expect(over / writing, face.family).toBeLessThanOrEqual(1 / 6);
      }
    }
  });

  it("never returns a size that rounds away to nothing", () => {
    expect(glyphEm(0, FACES.print)).toBeGreaterThan(0);
  });

  it("only shrinks type that would run out of its cell", () => {
    const face = FACES.dyslexic;
    // A word that fits leaves the em alone; the caller takes the smaller of
    // this and the ruling's own size.
    expect(fittedEm(1000, 0, face)).toBe(Infinity);
    const em = fittedEm(1000, 4, face);
    expect(4 * em * face.advance).toBeLessThanOrEqual(1000);
  });

  it("makes room for a wider face on the same line", () => {
    // OpenDyslexic is half as wide again as Andika, so four letters of it have
    // to be set smaller to reach the same margin.
    expect(fittedEm(1000, 4, FACES.dyslexic)) //
      .toBeLessThan(fittedEm(1000, 4, FACES.print));
  });
});

describe("the ink a stroked letterform is drawn with", () => {
  it("stays between a line that prints and a line that shouts", () => {
    for (const face of Object.values(FACES)) {
      for (const rule of HANDWRITING) {
        const { width } = traceInk(glyphEm(writingSpace(rule), face), face);
        expect(width, face.family).toBeGreaterThanOrEqual(MIN_INK);
        expect(width, face.family).toBeLessThanOrEqual(MAX_OUTLINE);
      }
    }
  });

  it("still reads as dots at every rule size", () => {
    // The acceptance criterion, as arithmetic. A dot is a zero-length dash
    // under a round cap, so its diameter is the stroke width — which means the
    // gap has to stay a multiple of that width at ⅜ inch as much as at one
    // inch, or the dots close up into a hollow outline.
    for (const face of Object.values(FACES)) {
      for (const rule of HANDWRITING) {
        const em = glyphEm(writingSpace(rule), face);
        const ink = traceInk(em, face);
        const [dash, gap] = ink.dotted.split(" ").map(Number);
        expect(dash, face.family).toBe(0);
        expect(gap / ink.width, face.family).toBeGreaterThanOrEqual(2);
        // And not so sparse that a letter is a handful of dots: a gap under a
        // fifth of the em puts several down the shortest stroke there is.
        expect(gap, `${face.family} at ${rule.style}`).toBeLessThan(em / 5);
      }
    }
  });

  it("draws dashes that are dashes rather than long dots", () => {
    for (const face of Object.values(FACES)) {
      const ink = traceInk(glyphEm(625, face), face);
      const [dash, gap] = ink.dashed.split(" ").map(Number);
      expect(dash, face.family).toBeGreaterThan(gap);
      expect(dash, face.family).toBeGreaterThan(ink.width * 2);
    }
  });

  it("keeps the dot-to-gap ratio when the ruling changes", () => {
    // Two rules an inch apart in size, one face: the pattern scales with the
    // letters instead of staying a fixed number of points.
    const face = FACES.cursive;
    const big = traceInk(glyphEm(1000, face), face);
    const small = traceInk(glyphEm(375, face), face);
    const ratio = (pattern: string, width: number) =>
      Number(pattern.split(" ")[1]) / width;
    expect(ratio(small.dotted, small.width)) //
      .toBeCloseTo(ratio(big.dotted, big.width), 5);
  });
});

/* ── The numbers describe real files ───────────────────────────────────────
   These proportions were measured out of the woff2 files in `public/fonts`, so
   a face renamed in the stylesheet and left alone in here would silently set
   type for a font nobody is looking at.                                     */

describe("the faces on disk", () => {
  const fonts = read("src/styles/fonts.css");
  const sheet = read("src/styles/sheet.css");

  it("is a family the sheet is actually set in", () => {
    for (const face of Object.values(FACES)) {
      expect(fonts, face.family).toContain(`font-family: "${face.family}"`);
      expect(sheet, face.family).toContain(`"${face.family}"`);
    }
  });

  it("is self-hosted, with the file in the repo", () => {
    const sources = [...fonts.matchAll(/url\("([^"]+)"\)/g)].map(
      (match) => match[1],
    );
    expect(sources.length).toBeGreaterThanOrEqual(Object.keys(FACES).length);
    for (const source of sources) {
      // A request to a CDN on a page a child is looking at is the thing
      // /privacy says doesn't happen here — so every face is a local path.
      expect(source.startsWith("/fonts/"), source).toBe(true);
      expect(existsSync(join(ROOT, "public", source)), source).toBe(true);
    }
    expect(fonts).not.toContain("http");
  });

  it("records where every one of them came from", () => {
    const licence = read("public/fonts/LICENSE.md");
    for (const face of Object.values(FACES)) {
      expect(licence, face.family).toContain(face.family);
    }
    expect(licence).toContain("Open Font License");
  });
});

/* ── The licence describes the same files ──────────────────────────────────
   This repo is public and it redistributes six fonts, so `public/fonts` is a
   distribution and the OFL's conditions are ours to meet — not the CDN's. The
   digests do double duty: they are how a reader checks a file against its
   distributor, and they are the only thing tying the constants above to the
   bytes they were measured out of.                                          */

describe("the licence beside the files", () => {
  const dir = join(ROOT, "public/fonts");
  const licence = read("public/fonts/LICENSE.md");
  /** Every `<sha256>  <file>.woff2` line `LICENSE.md` records. */
  const recorded = new Map(
    [...licence.matchAll(/^([0-9a-f]{64}) {2}(\S+\.woff2)$/gm)] //
      .map((line) => [line[2], line[1]] as const),
  );

  it("carries the licence text, not a link to it", () => {
    // OFL 1.1 condition 2 wants each redistributed copy to contain the licence
    // — a text file, a readable header or a metadata field. Only OpenDyslexic
    // has it inside the binary (name ID 13); the rest carry a URL, and a URL
    // is not a copy. `public/` ships to `dist/`, so this travels with the
    // fonts on the site as well as in the repo.
    const ofl = read("public/fonts/OFL.txt");
    expect(ofl).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(ofl).toContain("PERMISSION & CONDITIONS");
    expect(licence).toContain("OFL.txt");
  });

  it("accounts for every font in the directory", () => {
    const files = readdirSync(dir).filter((name) => name.endsWith(".woff2"));
    expect(files.length).toBeGreaterThan(0);
    expect([...recorded.keys()].sort()).toEqual(files.sort());
  });

  it("is describing the bytes that are actually there", () => {
    // Nothing else in the suite would notice a woff2 swapped for a different
    // cut of the same family: the name in the stylesheet wouldn't change, and
    // the arithmetic would stay self-consistent while printing letters through
    // the top rule. This is the pin — bytes and constants can only drift
    // together, and the provenance table stays true with them.
    for (const [file, digest] of recorded) {
      const sha = createHash("sha256")
        .update(readFileSync(join(dir, file)))
        .digest("hex");
      expect(sha, file).toBe(digest);
    }
  });
});

/* A ruling the shop offers but nobody writes between is still a ruling the
   trace blocks can be handed — copywork on college-ruled paper is a legitimate
   sheet — so the fallbacks have to hold there too. */
describe("rulings without a top line", () => {
  it("fills the repeat when there is no writing space to fill", () => {
    for (const style of ["wide", "college", "narrow"] as RuleStyle[]) {
      const rule: Rule = { style };
      const em = glyphEm(writingSpace(rule), FACES.print);
      expect(em).toBeGreaterThan(0);
      expect(em * FACES.print.ascent).toBeLessThanOrEqual(rulePitch(rule) + 1);
    }
  });
});
