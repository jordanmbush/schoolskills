import { describe, expect, it } from "vitest";

import { chromeHeight, sheetBlockBox, type FootLine } from "../chrome";
import { faceOf } from "../faces";
import { contentBox } from "../layout";
import { DEFAULT_FONT_PT, DEFAULT_PAPER, points } from "../paper";
import { SCRIPTURE_CREDIT, passage, passageText } from "../passages";
import type { Blank, MemoryConfig, SheetOptions } from "../types";

import {
  MAX_ROUNDS,
  MEMORY_SHEET,
  describeMemory,
  instructionOf,
  memoryLayout,
  memoryWords,
  removalCounts,
  roundHeight,
} from "./memory";

/**
 * The family whose exercise is what is missing from the page.
 *
 * Four properties, and two of them are promises to somebody outside this
 * repository:
 *
 * **The progression only ever takes.** A word missing in one round is missing
 * in every round after it, because a round that handed one back would read as a
 * misprint.
 *
 * **The answer key is the passage, whole** — and the instruction line says the
 * words were left out on purpose. Both halves are checked here, because both
 * are the licence rather than the layout (§12).
 *
 * **The last round is the empty one.** This family caps the number of rounds
 * and re-spreads them rather than dropping the end off the progression.
 *
 * **It fits.** A gap is wider than the word it replaces, so the rounds get
 * taller as the sheet goes on.
 */

const VERSE = "for-god-so-loved-the-world";

const BASE: MemoryConfig = {
  kind: "memory",
  paper: DEFAULT_PAPER,
  fontPt: DEFAULT_FONT_PT,
  fields: ["name", "date"],
  rounds: 4,
  passage: VERSE,
};

const config = (over: Partial<MemoryConfig> = {}): MemoryConfig => ({
  ...BASE,
  ...over,
});

/** The rounds a config actually printed. */
function roundsOf(over: Partial<MemoryConfig> = {}, seed = 1): Blank[] {
  const [block] = MEMORY_SHEET.build(config(over), seed).blocks;
  return block?.kind === "blanks" ? block.sentences : [];
}

/** Which words are missing from a round, as their places in the passage. */
const goneIn = (round: Blank): number =>
  round.text.split(" ").filter((word) => word === "_").length;

/** A round with its gaps filled from the answers, which is what a key prints. */
function filled(round: Blank): string {
  let at = 0;
  return round.text
    .split(" ")
    .map((word) => (word === "_" ? round.answers[at++] : word))
    .join(" ");
}

describe("what goes on a memory sheet", () => {
  it("writes the passage out whole first, and empty last", () => {
    const rounds = roundsOf();
    expect(rounds.length).toBe(4);
    expect(rounds[0].answers).toEqual([]);
    expect(rounds[0].text).toBe(passageText(passage(VERSE)!));
    // Every word gone in the last one: saying it from memory, with somewhere
    // to write it down.
    const words = memoryWords(passageText(passage(VERSE)!));
    expect(rounds[3].answers).toEqual(words);
    expect(rounds[3].text.replace(/[_ ]/g, "")).toBe("");
  });

  it("only ever takes words away, never gives one back", () => {
    // The property that makes it a progression rather than four sheets. A word
    // missing in round two is missing in round three.
    for (const rounds of [2, 3, 4, 5]) {
      const printed = roundsOf({ rounds });
      let previous = new Set<string>();
      for (const round of printed) {
        const missing = new Set(round.answers);
        for (const word of previous) {
          expect(missing.has(word), `${rounds} rounds`).toBe(true);
        }
        expect(missing.size).toBeGreaterThanOrEqual(previous.size);
        previous = missing;
      }
    }
  });

  it("spreads the removals evenly, nought to all", () => {
    expect(removalCounts(1, 12)).toEqual([0]);
    expect(removalCounts(2, 12)).toEqual([0, 12]);
    expect(removalCounts(3, 12)).toEqual([0, 6, 12]);
    expect(removalCounts(5, 10)).toEqual([0, 3, 5, 8, 10]);
    // Clamped, the way every count in the shop is: a saved config can say
    // anything, and a hundred rounds of a verse is not a sheet.
    expect(removalCounts(99, 8).length).toBe(MAX_ROUNDS);
    expect(removalCounts(0, 8)).toEqual([0]);
  });

  it("keeps the punctuation with the word it belongs to", () => {
    // What makes the finished key the passage rather than a paraphrase of it
    // with the commas guessed at.
    const rounds = roundsOf({ passage: "trust-in-the-lord", rounds: 3 });
    for (const round of rounds) {
      expect(filled(round)).toBe(
        passageText(passage("trust-in-the-lord")!).replace(/\s+/g, " "),
      );
    }
  });

  it("leaves a space between two gaps in a row", () => {
    // `Blanks` reads a run of underscores as ONE gap, so two missing words
    // written "__" would be one rule with two words expected in it and a key
    // that printed only the first. A space between them is the whole fix.
    for (const round of roundsOf({ rounds: 5 })) {
      expect(round.text).not.toMatch(/_{2,}/);
      expect(goneIn(round)).toBe(round.answers.length);
    }
  });
});

describe("the sheet it prints", () => {
  it("says the words are left out on purpose, and keys the whole passage", () => {
    // §12, in the two places it has to be: a sheet that quietly dropped a third
    // of a named translation would be publishing a modified text under its
    // name, and the answer key is what makes the claim recoverable.
    const sheet = MEMORY_SHEET.build(config(), 1);
    expect(sheet.header.instructions).toContain("left out");
    expect(sheet.header.instructions).toContain("answer key");
    expect(sheet.answers).toBe(false);

    const key = MEMORY_SHEET.key(sheet);
    expect(key.answers).toBe(true);
    expect(key.footer.note).toBe("Answer key");
    // And the credit survives the key, which is why it is a field of its own:
    // the page that carries the whole passage is the one that most needs to say
    // where the passage came from.
    expect(key.footer.source).toBe(SCRIPTURE_CREDIT);
  });

  it("carries the credit its source asks for, and none where none is", () => {
    expect(MEMORY_SHEET.build(config(), 1).footer.source).toBe(
      SCRIPTURE_CREDIT,
    );
    expect(
      MEMORY_SHEET.build(config({ passage: "bed-in-summer" }), 1).footer.source,
    ).toBeUndefined();
    expect(
      MEMORY_SHEET.build(config({ passage: undefined, text: "Mine." }), 1)
        .footer.source,
    ).toBeUndefined();
  });

  it("says nothing about missing words on a sheet that has none", () => {
    const one = MEMORY_SHEET.build(config({ rounds: 1 }), 1);
    expect(one.header.instructions).not.toContain("left out");
    expect(roundsOf({ rounds: 1 })[0].answers).toEqual([]);
  });

  it("names the passage, and has nothing to mark", () => {
    const sheet = MEMORY_SHEET.build(config(), 1);
    expect(sheet.header.title).toBe("Memory work — John 3:16");
    expect(sheet.header.score).toBeUndefined();
    expect(describeMemory(config())).toBe(
      "Memory work — John 3:16 — 4 times over",
    );
  });

  it("is the same page on every build, and a different one on another seed", () => {
    for (const seed of [0, 1, 4242]) {
      expect(JSON.stringify(MEMORY_SHEET.build(config(), seed))).toBe(
        JSON.stringify(MEMORY_SHEET.build(config(), seed)),
      );
    }
    // §7's "another sheet like this one": the same verse with other words out.
    expect(JSON.stringify(roundsOf({}, 1))).not.toBe(
      JSON.stringify(roundsOf({}, 2)),
    );
  });

  it("survives a config that says something this build has never heard of", () => {
    const stale = {
      ...config(),
      passage: "toString",
      translation: "constructor",
      rounds: "several",
    } as unknown as MemoryConfig;
    expect(() => MEMORY_SHEET.build(stale, 1)).not.toThrow();
    // Nothing to print, and a page that says so rather than a build that fails.
    expect(MEMORY_SHEET.build(stale, 1).blocks).toEqual([]);
  });
});

describe("what fits on the paper", () => {
  it("never prints more than the page holds, on either stock", () => {
    for (const size of ["letter", "a4", "legal"] as const) {
      for (const rounds of [1, 3, MAX_ROUNDS]) {
        for (const fontPt of [10, 12, 18]) {
          const asked = config({
            rounds,
            fontPt,
            paper: { size, orientation: "portrait", margin: "wide" },
            passage: "psalm-23",
          });
          const { box, rounds: printed } = memoryLayout(asked, 1);
          const height = printed.reduce(
            (total, round) => total + roundHeight(round, asked, box),
            0,
          );
          expect(height, `${size} × ${rounds} × ${fontPt}pt`) //
            .toBeLessThanOrEqual(box.height);
          // Against the header the sheet actually prints, which is the
          // reservation `chromeHeight` made rather than the content box.
          expect(box.height).toBeLessThanOrEqual(
            sheetBlockBox({
              paper: asked.paper,
              fontPt: asked.fontPt,
              fields: asked.fields,
            }).height,
          );
        }
      }
    }
  });

  it("reserves the rows the notice and the credit line actually wrap onto", () => {
    /*
     * The check the test above cannot make. "Never prints more than the page
     * holds" measures the rounds against `sheetBlockBox` — the same number the
     * layout used — so a chrome that under-reserved by a row satisfies it while
     * the last round prints below the bottom margin.
     *
     * This family is the one that made two rows of the chrome wrap: the §12
     * notice is 157 characters, and the answer key's foot carries a 75-character
     * Scripture credit beside "Answer key". Both are measured here against what
     * `chromeHeight` reserved, and both are measured off *sheet.css's* own
     * line-height rather than off `chrome.ts`'s rounded-up row — so the test
     * cannot pass by restating the constant it is checking.
     */
    const LINE = 1.35; // `.sheet`
    const INSTRUCTION_EM = 0.9; // `.sheet__instructions`
    const FOOT_EM = 0.62; // `.sheet__foot`
    const notice = instructionOf(4);

    for (const size of ["letter", "a4"] as const) {
      const paper = {
        size,
        orientation: "portrait",
        margin: "normal",
      } as const;
      const head: SheetOptions = {
        paper,
        fontPt: DEFAULT_FONT_PT,
        fields: ["name", "date"],
        title: "Memory work — Psalm 23",
        instructions: notice,
      };
      const width = contentBox(paper).width;

      /** How many rows a run of text takes, and how tall those rows are. */
      const wrapped = (text: string, share: number): number => {
        const advance =
          points(DEFAULT_FONT_PT * share) * faceOf(head.font).advance;
        const rows = Math.ceil((text.length * advance) / width);
        expect(rows, `${text.slice(0, 12)} on ${size}`).toBeGreaterThan(0);
        return rows * points(DEFAULT_FONT_PT * share * LINE);
      };

      // The header, less the header without the notice in it: whatever that
      // difference is, the wrapped sentence has to fit inside it.
      const bare: SheetOptions = { ...head, instructions: undefined };
      expect(
        chromeHeight(head).header - chromeHeight(bare).header,
        `notice on ${size}`,
      ).toBeGreaterThanOrEqual(wrapped(notice, INSTRUCTION_EM));

      // And the same for the credit line, against the foot without it. The note
      // is on both sides, because a key's footer carries it either way.
      const foot = (over: FootLine): number =>
        chromeHeight(head, false, over).footer;
      expect(
        foot({ source: SCRIPTURE_CREDIT, note: "Answer key" }) -
          foot({ note: "Answer key" }),
        `credit on ${size}`,
      ).toBeGreaterThanOrEqual(wrapped(SCRIPTURE_CREDIT, FOOT_EM));
    }
  });

  it("drops a round rather than the end of the progression", () => {
    // A long psalm cannot have five rounds on one page. What it must not do is
    // print the first four and stop: the last round is the one the whole sheet
    // aims at, so the count comes down and the removals spread again.
    const long = roundsOf({ passage: "psalm-23", rounds: 5 });
    expect(long.length).toBeLessThan(5);
    expect(long.length).toBeGreaterThan(1);
    expect(long[0].answers).toEqual([]);
    expect(long[long.length - 1].text.replace(/[_ ]/g, "")).toBe("");
  });

  it("comes down to one round rather than printing a round off the bottom", () => {
    // A paste at the cap is more than a progression can be made of, so what is
    // left is the passage itself — which is still a page worth having, and is
    // what the arithmetic arrives at on its own rather than by a special case.
    const long = roundsOf({ passage: undefined, text: "word ".repeat(600) });
    expect(long.length).toBe(1);
    expect(long[0].answers).toEqual([]);
    // And a config with nothing to say prints a header over an empty page,
    // rather than a build that fails on the way to a catalog.
    expect(roundsOf({ passage: undefined, text: "" })).toEqual([]);
  });
});
