import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CURSIVE_FACES,
  FACES,
  MAX_OUTLINE,
  MIN_INK,
  cursiveOf,
  faceOf,
  fittedEm,
  glyphEm,
  glyphHeight,
  isCursive,
  traceInk,
} from "./faces";
import { RULINGS, rulePitch, writingSpace } from "./paper";
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

describe("the cursive models", () => {
  it("is three of the five, with the looped hand first", () => {
    // First because it is the default and the id every cursive sheet saved so
    // far already carries — a picker that reordered these would change what
    // `cursiveOf` answers for a sheet that never asked for a model.
    expect(CURSIVE_FACES[0]).toBe("cursive");
    expect(CURSIVE_FACES).toHaveLength(3);
    for (const font of CURSIVE_FACES) {
      expect(isCursive(font), font).toBe(true);
      expect(faceOf(font).family, font).toContain("Playwrite");
    }
    for (const font of ["print", "dyslexic"] as SheetFont[]) {
      expect(isCursive(font), font).toBe(false);
    }
    expect(isCursive(undefined)).toBe(false);
  });

  it("is three different hands rather than three names for one", () => {
    // If two of them measured the same, one of them would be a second entry
    // for a font already in the table and the choice would be a lie.
    const shapes = CURSIVE_FACES.map((font) => {
      const face = faceOf(font);
      return `${face.family}:${face.ascent}:${face.descent}:${face.advance}`;
    });
    expect(new Set(shapes).size).toBe(CURSIVE_FACES.length);
  });

  it("answers with a joining face for anything that has to be joined", () => {
    // What a joins sheet asks: a print face has no stroke between two letters,
    // so the content that is only a join resolves to a hand that draws one —
    // keeping the model that was chosen when one was.
    expect(cursiveOf("print")).toBe("cursive");
    expect(cursiveOf(undefined)).toBe("cursive");
    expect(cursiveOf("dyslexic")).toBe("cursive");
    expect(cursiveOf("gothic" as SheetFont)).toBe("cursive");
    for (const font of CURSIVE_FACES) expect(cursiveOf(font)).toBe(font);
  });
});

describe("sizing letters to a ruling", () => {
  it("puts the tallest letter on the top line, in every face", () => {
    // The whole reason the proportions are measured rather than shared: the
    // same rule holds a different em in each of the five, and a capital that
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

  it("sizes a capital or a numeral off its own height, not off an ascender", () => {
    // The thing a sheet of nothing but capitals gets wrong otherwise. Andika
    // is a text face: its caps are 0.713 against a 0.791 ascender, so a page
    // of them sized off `ascent` stops a tenth of the writing space short of
    // the top line — on a sheet whose whole copy is "every capital starts at
    // the top line".
    for (const face of Object.values(FACES)) {
      expect(glyphHeight("ABC", face), face.family).toBe(face.capHeight);
      expect(glyphHeight("0123", face), face.family).toBe(face.figure);
      // Neither is ever taller than the ascender, or a row would be sized off
      // the wrong one of the three the moment the two were mixed.
      expect(face.capHeight, face.family).toBeLessThanOrEqual(face.ascent);
      expect(face.figure, face.family).toBeLessThanOrEqual(face.ascent);
    }

    // And it is a real difference, not a rounding of the same number: an
    // Andika capital sheet is set a tenth larger than an Andika `Aa` one.
    expect(glyphEm(500, FACES.print, "ABC")) //
      .toBeGreaterThan(glyphEm(500, FACES.print, "Aa"));
  });

  it("goes back to the ascender the moment the row is mixed", () => {
    // A row cannot put a capital and an `l` on the top line at once. The
    // ascender wins, because a capital a tenth under the line is a smaller
    // error than an ascender drawn through it — and an empty row has to agree
    // with the row above it rather than resize itself.
    for (const face of Object.values(FACES)) {
      expect(glyphHeight("Aa", face), face.family).toBe(face.ascent);
      expect(glyphHeight("A1a", face), face.family).toBe(face.ascent);
      expect(glyphHeight("", face), face.family).toBe(face.ascent);
      expect(glyphHeight("— .", face), face.family).toBe(face.ascent);
      // Two classes with no lower-case between them take the taller of them.
      expect(glyphHeight("A1", face), face.family) //
        .toBe(Math.max(face.capHeight, face.figure));
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

  it("keeps a tail in the room the ruling gives it", () => {
    // The other end of the same question. A handwriting rule with descender
    // space gives a third of its repeat to the tail against two thirds to the
    // writing space, so the room below the baseline is half the writing space
    // — which is `ascent / 2` of the em at every rule size, and the number a
    // measured `descent` has to be checked against.
    //
    // Playwrite is the one face that hangs over, by 0.009 of the em: a joined
    // script draws its loops to the full descender the file declares. Four
    // thousandths of an inch on a ⅝ rule is the stated tolerance, and it is
    // drawn rather than clipped — see `.sheet__ink--trace` in sheet.css.
    for (const face of Object.values(FACES)) {
      const room = face.ascent / 2;
      expect(face.descent, face.family).toBeLessThanOrEqual(room + 0.01);
      // And deep enough to be a tail at all: a `g` whose loop stopped at a
      // twentieth of an em would be a face measured off the wrong glyph.
      expect(face.descent, face.family).toBeGreaterThan(0.15);
    }
    expect(FACES.print.descent).toBeLessThan(FACES.print.ascent / 2);
    expect(FACES.dyslexic.descent).toBeLessThan(FACES.dyslexic.ascent / 2);
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
   This repo is public and it redistributes eight fonts, so `public/fonts` is a
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
