import { describe, expect, it } from "vitest";

import { printedBlockBox } from "../chrome";
import { MARGINS, toInches } from "../paper";
import { SCRIPTURE_CREDIT } from "../passages";
import type {
  CardStyle,
  CardsConfig,
  MarginSize,
  PaperSize,
  Sheet,
} from "../types";
import { buildSheet, describeSheet, sheetSpec } from "../index";
import { describeSheetFamily } from "../contract";

import {
  CARDS_SHEET,
  CARD_STEP,
  canFold,
  cardsKeyed,
  inchLabel,
  layoutsFor,
} from "./cards";

/**
 * The one shelf whose geometry is checked with a pair of scissors.
 *
 * Three claims, all made against the finished block rather than against the
 * arithmetic that made it: the card is the size the sheet says it is, a whole
 * number of eighths and never larger than the room there is; the grid is
 * exactly `columns × width` by `rows × height`, so with no gutter the cut
 * guides fall on the card boundaries by construction; and every card is on the
 * page, `columns × rows` faces even where most are blank.
 *
 * What is left over goes round the block, which is `margin-inline: auto` in
 * sheet.css and is checked in `Sheet.test.tsx` where the markup is.
 */

const STYLES: CardStyle[] = [
  "flashcard",
  "name-tag",
  "bookmark",
  "verse-card",
  "certificate",
];

const config = (over: Partial<CardsConfig> = {}): CardsConfig => ({
  kind: "cards",
  style: "flashcard",
  paper: { size: "letter", orientation: "portrait", margin: "normal" },
  fontPt: 12,
  fields: [],
  ...over,
});

/** The one card block on a sheet, or a failure that says so. */
function cardsOf(sheet: Sheet) {
  const blocks = sheet.blocks.filter((block) => block.kind === "cutcards");
  expect(blocks).toHaveLength(1);
  return blocks[0];
}

/* ── The geometry ──────────────────────────────────────────────────────── */

describe("a page of cards", () => {
  it("offers 2-up and 4-up on every style, which is the acceptance criterion", () => {
    // §17 asks for both wherever the template is a card, and every style here
    // is cut out. Read off `layoutsFor`, which is what the builder's control
    // offers and what `layoutOf` resolves against — so a style that lost one
    // fails here rather than in a comment claiming otherwise.
    for (const style of STYLES) {
      const up = layoutsFor(style).map((layout) => layout.up);
      expect(up, style).toContain(2);
      expect(up, style).toContain(4);
    }
  });

  it("measures a whole number of eighths of an inch, both ways", () => {
    // The dimension is quoted on the catalog page and printed in the sheet's
    // own description, so it has to be a number somebody can hold a ruler
    // against. 3.734 inches is not one.
    for (const style of STYLES) {
      for (const layout of layoutsFor(style)) {
        for (const size of ["letter", "a4", "legal"] as PaperSize[]) {
          const block = cardsOf(
            buildSheet(
              config({
                style,
                up: layout.up,
                paper: { size, orientation: "portrait", margin: "normal" },
              }),
              1,
            ),
          );
          expect(block.card.width % CARD_STEP, `${style} ${layout.up}-up`).toBe(
            0,
          );
          expect(block.card.height % CARD_STEP).toBe(0);
        }
      }
    }
  });

  it("never lays out more paper than there is", () => {
    for (const style of STYLES) {
      for (const layout of layoutsFor(style)) {
        for (const size of ["letter", "a4", "legal"] as PaperSize[]) {
          for (const margin of Object.keys(MARGINS) as MarginSize[]) {
            for (const orientation of ["portrait", "landscape"] as const) {
              const sheet = buildSheet(
                config({
                  style,
                  up: layout.up,
                  paper: { size, orientation, margin },
                }),
                1,
              );
              const block = sheet.blocks.find(
                (candidate) => candidate.kind === "cutcards",
              );
              if (!block) continue; // Too small to cut — see the refusal below.
              const box = printedBlockBox(sheet);
              const where = `${style} ${layout.up}-up on ${size}/${margin}/${orientation}`;
              expect(
                block.columns * block.card.width,
                where,
              ).toBeLessThanOrEqual(box.width);
              expect(block.rows * block.card.height, where).toBeLessThanOrEqual(
                box.height,
              );
            }
          }
        }
      }
    }
  });

  it("wastes less than a step per card doing it", () => {
    // The rounding is the point of the design and the cost of it is bounded:
    // an eighth of an inch per card at the very worst, and usually far less.
    // Without this the test above would pass on a family that printed
    // postage stamps.
    for (const style of STYLES) {
      for (const layout of layoutsFor(style)) {
        const sheet = buildSheet(config({ style, up: layout.up }), 1);
        const block = cardsOf(sheet);
        const box = printedBlockBox(sheet);
        expect(
          box.width - block.columns * block.card.width,
          `${style} ${layout.up}-up`,
        ).toBeLessThan(block.columns * CARD_STEP);
      }
    }
  });

  it("wastes no more down the page than it does across it", () => {
    // The same bound the other way up, and it is not the same test: a family
    // that divided the available *height* by the column count would print short
    // cards and pass every claim above, because nothing there reads the height
    // against the page. The bookmark is out because its height is deliberately
    // capped at seven and a half inches — see the test that pins the ceiling.
    for (const style of STYLES) {
      if (style === "bookmark") continue;
      for (const layout of layoutsFor(style)) {
        const sheet = buildSheet(config({ style, up: layout.up }), 1);
        const block = cardsOf(sheet);
        const box = printedBlockBox(sheet);
        expect(
          box.height - block.rows * block.card.height,
          `${style} ${layout.up}-up`,
        ).toBeLessThan(block.rows * CARD_STEP);
      }
    }
  });

  it("prints a card for every place in the grid, blank or not", () => {
    for (const style of STYLES) {
      for (const layout of layoutsFor(style)) {
        const block = cardsOf(buildSheet(config({ style, up: layout.up }), 1));
        expect(block.columns * block.rows, `${style} ${layout.up}-up`).toBe(
          layout.up,
        );
        expect(block.faces).toHaveLength(layout.up);
      }
    }
  });

  it("keeps a bookmark short enough to fit in a book", () => {
    // The one style with a ceiling. Without it a bookmark is as long as the
    // page, which is nine and a half inches and does not go in a paperback.
    const block = cardsOf(buildSheet(config({ style: "bookmark", up: 4 }), 1));
    expect(toInches(block.card.height)).toBeLessThanOrEqual(7.5);
    expect(toInches(block.card.height)).toBeGreaterThan(6);
  });

  it("takes the nearest layout it has when asked for one it hasn't", () => {
    // `up` arrives from a saved sheet as readily as from the control beside the
    // preview. Five flashcards should print four, not nothing.
    expect(cardsOf(buildSheet(config({ up: 5 }), 1)).faces).toHaveLength(4);
    expect(cardsOf(buildSheet(config({ up: 999 }), 1)).faces).toHaveLength(10);
  });

  it("refuses to print confetti", () => {
    // A card under three quarters of an inch is not something anybody cuts out.
    // No block at all is the honest answer, and it is one a page can see.
    const sheet = buildSheet(
      config({
        style: "flashcard",
        up: 10,
        paper: { size: "letter", orientation: "landscape", margin: "wide" },
        fontPt: 36,
        title: "A title, an instruction, and no room left",
        instructions:
          "A long instruction line, which takes rows out of the page before the cards get any of it at all.",
      }),
      1,
    );
    // Either it drew cards that fit, or it drew nothing. What it must never do
    // is draw cards that do not fit, which the sweep above already forbids.
    const block = sheet.blocks.find(
      (candidate) => candidate.kind === "cutcards",
    );
    if (block) expect(block.card.height).toBeGreaterThanOrEqual(750);
  });
});

/* ── What is on a card ─────────────────────────────────────────────────── */

describe("what a card carries", () => {
  it("is blank until somebody types something", () => {
    // "Blank flashcards" is the query. A blank card is the sheet, not a
    // degenerate case of one.
    const block = cardsOf(buildSheet(config(), 1));
    expect(block.faces.every((face) => Object.keys(face).length === 0)).toBe(
      true,
    );
    expect(block.frame).toBe("plain");
  });

  it("fills the cards it has words for and leaves the rest empty", () => {
    const block = cardsOf(
      buildSheet(config({ up: 8, words: ["one", "two"] }), 1),
    );
    expect(block.faces[0].heading).toBe("one");
    expect(block.faces[1].heading).toBe("two");
    expect(block.faces[2].heading).toBeUndefined();
    expect(block.faces).toHaveLength(8);
  });

  it("sets the heading small enough to stay on the card", () => {
    // Declared rather than measured, off the face's own mean advance. A word
    // set at the style's size regardless would print off the side of a card
    // whose whole job is to be cut out at that size.
    const wide = cardsOf(
      buildSheet(
        config({ up: 10, words: ["antidisestablishmentarianism"] }),
        1,
      ),
    );
    const narrow = cardsOf(buildSheet(config({ up: 10, words: ["cat"] }), 1));
    expect(wide.headingEms).toBeLessThan(narrow.headingEms);
    expect(wide.headingEms).toBeGreaterThan(0);
  });

  it("puts the verse on the card and the credit in the footer", () => {
    // §12: the credit travels on the passage rather than beside it, and it is a
    // condition of the name rather than a courtesy.
    const sheet = buildSheet(
      config({
        style: "verse-card",
        up: 6,
        passage: "for-god-so-loved-the-world",
      }),
      1,
    );
    const block = cardsOf(sheet);
    expect(block.faces[0].heading).toBe("John 3:16");
    expect(block.faces[0].body).toContain("For God so loved the world");
    expect(sheet.footer.source).toBe(SCRIPTURE_CREDIT);
    // Every card, not just the first: a page of six is six of the same verse.
    expect(block.faces.every((face) => face.heading === "John 3:16")).toBe(
      true,
    );
  });

  it("is the same words on a bookmark, on a different rectangle", () => {
    // The pair §12 asks for, and the reason they are one style with a shape
    // each rather than two families: a memory-verse card goes in a pocket and a
    // Scripture bookmark goes in the book it was read out of.
    const card = cardsOf(
      buildSheet(config({ style: "verse-card", passage: "psalm-23" }), 1),
    );
    const mark = cardsOf(
      buildSheet(config({ style: "bookmark", passage: "psalm-23" }), 1),
    );
    expect(mark.faces[0].body).toBe(card.faces[0].body);
    expect(mark.card.height).toBeGreaterThan(mark.card.width);
  });

  it("rules a blank verse card to write one on by hand", () => {
    const block = cardsOf(buildSheet(config({ style: "verse-card" }), 1));
    expect(block.faces[0].lines).toBeGreaterThan(0);
    expect(block.faces[0].body).toBeUndefined();
  });

  it("gives a certificate a line for everything it does not know", () => {
    // The name is written on the paper and is never in the config (§1), so it
    // is a rule with what it is for set under it.
    const plain = cardsOf(buildSheet(config({ style: "certificate" }), 1));
    expect(plain.frame).toBe("award");
    expect(plain.faces[0].heading).toBe("Certificate of Achievement");
    expect(plain.faces[0].fields).toEqual([
      "Awarded to",
      "For",
      "Date",
      "Signed",
    ]);

    const reasoned = cardsOf(
      buildSheet(
        config({
          style: "certificate",
          reason: "for finishing the times tables",
        }),
        1,
      ),
    );
    expect(reasoned.faces[0].body).toBe("for finishing the times tables");
    // The line it was written on is gone, because it has been written on.
    expect(reasoned.faces[0].fields).toEqual(["Awarded to", "Date", "Signed"]);
  });

  it("folds a tent where a tent is a thing, and nowhere else", () => {
    // The two panels of a tent are the same piece of paper, so they cannot be
    // out of register with each other — which is what a printed back on a home
    // printer cannot promise. A folded certificate is not a thing.
    expect(canFold("name-tag")).toBe(true);
    expect(canFold("flashcard")).toBe(true);
    expect(canFold("certificate")).toBe(false);
    expect(canFold("bookmark")).toBe(false);

    expect(
      cardsOf(buildSheet(config({ style: "name-tag", fold: true }), 1)).fold,
    ).toBe(true);
    expect(
      cardsOf(buildSheet(config({ style: "certificate", fold: true }), 1)).fold,
    ).toBeUndefined();
  });

  it("prints no title over a page of cards", () => {
    // The same argument the lined-paper family makes: a page of blank
    // flashcards with "Blank flashcards" across the top is a page with one
    // fewer card on it.
    expect(buildSheet(config(), 1).header.title).toBe("");
  });
});

/* ── The promises every family makes ───────────────────────────────────── */

describeSheetFamily("cards", {
  label: "Cards, tags and bookmarks",
  spec: CARDS_SHEET,
  config,
  shapes: STYLES.map((style) => ({
    style,
    passage: "psalm-23",
    words: ["a", "b"],
  })),
  keyed: cardsKeyed,
});

describe("the cards family", () => {
  it("names the size it actually printed", () => {
    // The catalog quotes this line, so it is a claim about the paper rather
    // than a description of it.
    const sheet = buildSheet(config({ up: 8 }), 1);
    const block = cardsOf(sheet);
    const line = describeSheet(config({ up: 8 }));
    expect(line).toContain(
      `${inchLabel(block.card.width)} by ${inchLabel(block.card.height)} inches`,
    );
    expect(line).toContain("8 to a page");
    // Never "1 certificates".
    expect(describeSheet(config({ style: "certificate", up: 1 }))).toContain(
      "1 to a page",
    );
  });

  it("withholds nothing, and says so where a page can ask", () => {
    expect(cardsKeyed()).toBe(false);
    const sheet = buildSheet(config(), 1);
    const key = sheetSpec("cards").key(sheet);
    expect(key.blocks).toEqual(sheet.blocks);
    expect(key.footer.note).toBe("Answer key");
  });

  it("prints a page from a config that arrived from outside this build", () => {
    const hostile = {
      ...config(),
      style: "hasOwnProperty" as CardStyle,
      up: Number.NaN,
      words: [1, null, " real "] as unknown as string[],
      passage: "no-such-verse",
    };
    const block = cardsOf(buildSheet(hostile, 1));
    expect(block.faces.length).toBeGreaterThan(0);
    expect(block.faces[0].heading).toBe("real");
  });
});
