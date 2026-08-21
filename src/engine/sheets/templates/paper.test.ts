import { describe, expect, it } from "vitest";

import { sheetBlockBox } from "../chrome";
import { answerKey, buildSheet, describeSheet } from "../index";
import { describeSheetFamily } from "../contract";
import { contentBox, ruledLines } from "../layout";
import { RULINGS, inches, rulePitch } from "../paper";
import type {
  MarginSize,
  Paper,
  PaperConfig,
  PaperSize,
  Rule,
  RuleStyle,
} from "../types";

import { PAPER_SHEET } from "./paper";

/**
 * The family the geometry is proved on.
 *
 * A sheet of lined paper is nothing but its ruling, so there is nowhere for a
 * rule that is a thousandth out to hide — which is why the story that ships it
 * is the one that asks for a ruler on a real printer. These are the half of
 * that check a machine can do: that the arithmetic says ⅝ of an inch, on both
 * stocks and at every margin, and that the last rule is on the page.
 */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<PaperConfig> = {}): PaperConfig => ({
  kind: "paper",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  rule: { style: "wide" },
  ...over,
});

/** The one block a paper sheet has, narrowed for the reader. */
function rulesOf(over: Partial<PaperConfig> = {}) {
  const block = buildSheet(config(over), 0).blocks[0];
  if (block.kind !== "rules")
    throw new Error(`expected rules, got ${block.kind}`);
  return block;
}

/** Every ruling in §5, which is every ruling there is. */
const STYLES = Object.keys(RULINGS) as RuleStyle[];
const RULED = STYLES.filter((style) => RULINGS[style].pitch > 0);

const SIZES: PaperSize[] = ["letter", "a4", "legal"];
const MARGINS: MarginSize[] = ["none", "narrow", "normal", "wide"];

describeSheetFamily("paper", {
  label: "Lined and graph paper",
  spec: PAPER_SHEET,
  config,
  shapes: STYLES.map((style) => ({ rule: { style } })),
  keyed: () => false,
});

describe("the paper family", () => {
  it("rules a sheet in every ruling of §5", () => {
    for (const style of RULED) {
      const block = rulesOf({ rule: { style } });
      expect(block.rule.style).toBe(style);
      expect(block.lines).toBeGreaterThan(0);
    }
  });

  it("draws nothing on blank paper, rather than a zero-height box", () => {
    // Blank is a ruling with no pitch. Nought repeats is the honest answer.
    expect(rulesOf({ rule: { style: "blank" } }).lines).toBe(0);
  });

  it("has nothing to answer, so its key is the sheet itself", () => {
    // Paper is supposed to be empty (§11). A key that differed from the sheet
    // would be inventing something to have been right about.
    expect(answerKey(config(), 0)).toEqual(buildSheet(config(), 0));
  });
});

/* ── The geometry, which is the whole point ────────────────────────────── */

describe("what a ruler would find", () => {
  it("puts a ⅝ rule ⅝ of an inch from the next one, on Letter and on A4", () => {
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        const rule: Rule = { style: "hand-5-8", descender: true };
        const block = rulesOf({ paper: paper({ size, margin }), rule });
        const box = contentBox(paper({ size, margin }));
        const tops = ruledLines(
          { ...box, height: block.lines * rulePitch(rule) },
          rule,
        )
          .filter((line) => line.role === "top")
          .map((line) => line.y);

        expect(tops.length).toBe(block.lines);
        for (let i = 1; i < tops.length; i++) {
          expect(tops[i] - tops[i - 1]).toBe(inches(0.625));
        }
      }
    }
  });

  it("never rules past the bottom of the paper, whatever it is printed on", () => {
    // The failure this exists to catch is silent on screen and obvious on
    // paper: one rule too many is a second sheet out of the printer.
    //
    // Measured against the *block* box, which is the only box that can fail.
    // The content box cannot: `ruleCapacity` floors against a height that is
    // already the content box minus the chrome, so a family that reserved
    // nothing at all would still satisfy it, and deleting `chromeHeight()` would
    // leave this test green while every sheet overran its footer.
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const style of RULED) {
          const rule: Rule = { style };
          const over = { paper: paper({ size, margin }), rule };
          const lines = rulesOf(over).lines;
          const pitch = rulePitch(rule);
          const box = sheetBlockBox(config(over));

          expect(lines * pitch).toBeLessThanOrEqual(box.height);
          // ...and one more would not have fitted, which is what makes the
          // reservation testable in both directions.
          expect((lines + 1) * pitch).toBeGreaterThan(box.height);
        }
      }
    }
  });

  it("does not throw the page away either", () => {
    // The half the block box cannot see: what the chrome took in the first
    // place. A family that reserved for the worst case would satisfy every
    // assertion above and still cost each sheet two lines to write on, which
    // on ⅝ paper a child notices. Name and date, no title, no instructions —
    // the sheet the catalog actually ships — spends under an inch on chrome.
    const bare = config();
    const spare = contentBox(bare.paper).height - sheetBlockBox(bare).height;
    expect(spare).toBeGreaterThan(0);
    expect(spare).toBeLessThan(inches(0.8));
  });

  it("reserves a second row when the name line wraps onto one", () => {
    // `HEAD_ROWS.fields` is charged per row, not per line. Three fields are
    // all legal in `HeaderField` and measure more than a Letter content width
    // between them, so they wrap — and a wrap that was not reserved for puts
    // the last rule below the bottom margin and a blank second page out of
    // the printer. Not reachable from the shipped catalog, which always
    // passes two; reachable from `buildSheet` today and from the builder next.
    const two = config();
    const three = config({ fields: ["name", "date", "class"] });
    expect(sheetBlockBox(three).height).toBeLessThan(sheetBlockBox(two).height);

    // The sheet pays for the row by losing a line, rather than by overrunning.
    const rule: Rule = { style: "narrow" };
    expect(rulesOf({ fields: ["name", "date", "class"], rule }).lines).toBe(
      rulesOf({ rule }).lines - 1,
    );
  });

  it("gives a sheet with no title the lines the title would have taken", () => {
    // Chrome is counted from what the header holds, not from a constant.
    const bare = rulesOf({ rule: { style: "hand-5-8" } });
    const titled = rulesOf({
      rule: { style: "hand-5-8" },
      title: "Spelling practice",
      instructions: "Write each word three times.",
    });
    expect(bare.lines).toBeGreaterThan(titled.lines);
  });
});

/* ── The two choices a handwriting rule offers (§5) ────────────────────── */

describe("handwriting rules", () => {
  const hand = (over: Partial<Rule>) =>
    rulesOf({ rule: { style: "hand-5-8", ...over } }).rule;

  it("carries the midline the config asked for, all three of them", () => {
    expect(hand({}).midline).toBeUndefined(); // dashed, the default schools print
    expect(hand({ midline: "solid" }).midline).toBe("solid");
    expect(hand({ midline: "none" }).midline).toBe("none");
  });

  it("takes the descender space out of the repeat, not out of the pitch", () => {
    // The toggle is the difference between a sheet a child can write a `g` on
    // and one they can't — but ⅝ paper stays ⅝ paper either way, or every
    // ruling would silently reprice itself when the box was ticked.
    const rule: Rule = { style: "hand-5-8", descender: true };
    const withTail = rulesOf({ rule });
    const without = rulesOf({ rule: { style: "hand-5-8" } });
    expect(withTail.rule.descender).toBe(true);
    expect(without.rule.descender).toBeUndefined();
    expect(withTail.lines).toBe(without.lines);
  });

  it("names the midline and the tail space, because a shop's label doesn't", () => {
    expect(describeSheet(config({ rule: { style: "wide" } }))).toBe(
      "Wide ruled paper",
    );
    expect(
      describeSheet(config({ rule: { style: "hand-5-8", descender: true } })),
    ).toBe('Handwriting ⅝" paper — dashed midline — room for descenders');
    expect(
      describeSheet(config({ rule: { style: "hand-3-8", midline: "none" } })),
    ).toBe('Handwriting ⅜" paper — no midline — no descender space');
  });
});
