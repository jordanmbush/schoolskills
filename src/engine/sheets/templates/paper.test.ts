import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
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

describe("the paper family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("paper")).toBe(PAPER_SHEET);
    expect(sheetSpec("paper").label).toBe("Lined and graph paper");
  });

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

  it("is a pure function of its config, like every other family", () => {
    for (const seed of [0, 1, 4242]) {
      expect(buildSheet(config(), seed)).toEqual(buildSheet(config(), seed));
    }
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
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const style of RULED) {
          const rule: Rule = { style };
          const block = rulesOf({ paper: paper({ size, margin }), rule });
          const height = block.lines * rulePitch(rule);
          expect(height).toBeLessThanOrEqual(
            contentBox(paper({ size, margin })).height,
          );
        }
      }
    }
  });

  it("does not throw the page away either", () => {
    // The other half of the same property. What is left over has to be the
    // header, the footer and less than one more repeat — a family that
    // reserved for the worst case would cost every sheet two lines to write
    // on, which on ⅝ paper a child notices.
    for (const style of RULED) {
      const rule: Rule = { style };
      const block = rulesOf({ rule });
      const spare = contentBox(paper()).height - block.lines * rulePitch(rule);
      expect(spare).toBeLessThan(rulePitch(rule) + inches(0.8));
    }
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
