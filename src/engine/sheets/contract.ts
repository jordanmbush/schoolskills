/**
 * The promises every sheet family makes, asserted in one place (§20).
 *
 * They are the whole of what `SheetSpec` means beyond its types: a family is in
 * the registry under the kind its config carries, draws the same sheet from the
 * same seed, prints on the paper it was handed, and hands back a key that is the
 * sheet it belongs to with the answers switched on (§7). Copied into each
 * family's suite by hand — as they were — a family keeps as much of the contract
 * as its author happened to remember, and the twenty-eighth keeps whatever its
 * author noticed the other twenty-seven doing.
 *
 * A family that keeps all of it can still be wrong, and nothing here would know:
 * whether the sums add up is the one bug a worksheet site cannot ship, and that
 * is checked in the family's own suite, against a path the family does not use.
 * This is the floor, not the ceiling.
 *
 * Test-only, and never in a bundle — it reaches `index.ts`, which awaits every
 * family at load. Not named `.test.ts` because it defines a suite rather than
 * being one, and vitest fails a test file that holds no tests.
 * `contract.test.ts` next door is the other half: the guard that every family in
 * the registry actually calls this.
 */
import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "./index";
import { sheetFamily } from "./families";
import { SHEET_CREDIT, SHEET_URL, type SheetSpec } from "./spec";
import type { SheetConfig } from "./types";

/**
 * What a key says at the foot of the page.
 *
 * Every family writes this literal for itself, so here is where they are held to
 * the same word: a parent printing sheet and key from two families should not
 * find two different things at the bottom of the two pages.
 */
const KEY_NOTE = "Answer key";

/** The seeds a family is swept over when its suite names none of its own. */
const SEEDS = [0, 1, 4242];

/**
 * A second stock and a second type size, laid over every shape.
 *
 * Here rather than in the shapes a suite passes, because almost none of them
 * vary the paper — and a family that ignored `config.paper` outright would
 * satisfy a check made only against the Letter default that produced it.
 */
const OTHER_STOCK = {
  paper: { size: "a4", orientation: "landscape", margin: "wide" },
  fontPt: 18,
} as const;

export type SheetFamilyContract<C extends SheetConfig> = {
  /** How the picker names it — the string in families.ts. */
  label: string;
  spec: SheetSpec<C>;
  /** The suite's own config factory: defaults, with the shape laid over. */
  config: (over?: Partial<C>) => C;
  /**
   * Every shape of sheet worth sweeping. Whole configs are as welcome as
   * partial ones — a suite that already keeps a list of them can hand it
   * straight over. Left out, the contract holds the family to its defaults.
   */
  shapes?: Array<Partial<C>>;
  seeds?: number[];
  /**
   * Whether this config withholds something a key would reveal — the family's
   * own `formKeyed`/`chartKeyed`/`phonicsKeyed` where it has one.
   *
   * The default says yes, so a family that has an answer key and forgets to say
   * so is still held to printing one. The families it is passed for are the
   * blank ones: paper, cards, calendars. A key of one of those is the same page
   * again (§11), and a page that claimed to be revealing something would be
   * telling a parent to look for what isn't there.
   */
  keyed?: (config: C) => boolean;
};

/**
 * Assert the contract for one family. Called from the family's own suite, which
 * keeps the family-specific half of the file next to the generic half, and calls
 * the contract with the shapes that suite already sweeps.
 */
export function describeSheetFamily<C extends SheetConfig>(
  kind: string,
  contract: SheetFamilyContract<C>,
): void {
  const {
    label,
    spec,
    config,
    shapes = [{}],
    seeds = SEEDS,
    keyed = () => true,
  } = contract;

  const configs = shapes.map((shape) => config(shape));
  /** Which sheet a failure is about: the family, and the line it prints under. */
  const where = (one: C) => `${kind}: ${describeSheet(one)}`;

  describe(`the ${kind} family keeps the contract`, () => {
    it("is in the registry under the kind its config carries", () => {
      expect(
        sheetSpec(kind),
        `${kind}: sheetSpec("${kind}") is not this family's own spec — check the loader in families.ts points at the module that exports it`,
      ).toBe(spec);
      expect(
        sheetFamily(kind)?.label,
        `${kind}: the name the picker offers it under`,
      ).toBe(label);
    });

    it("builds the same sheet twice", () => {
      for (const one of configs) {
        for (const seed of seeds) {
          const once = buildSheet(one, seed);
          const twice = buildSheet(one, seed);
          // Two builds, not one handed back twice — otherwise a family that
          // cached a sheet would satisfy the comparison below by identity.
          expect(once, `${where(one)} at seed ${seed}`).not.toBe(twice);
          expect(
            once,
            `${where(one)} at seed ${seed}: not a pure function of (config, seed), so a parent cannot have the same sheet again and the key may not match the page`,
          ).toEqual(twice);
        }
      }
    });

    it("prints on the paper it was handed, in the type it was asked for", () => {
      // A renderer is given a `Sheet` and nothing else, so a family that read
      // the config and then printed on its own default would be invisible until
      // a parent held the printout against A4 (§4, §17).
      for (const one of configs) {
        for (const asked of [one, { ...one, ...OTHER_STOCK }]) {
          const sheet = buildSheet(asked, 3);
          const on = `${where(one)} on ${asked.paper.size} at ${asked.fontPt}pt`;
          expect(sheet.paper, `${on}: the paper it printed on`) //
            .toEqual(asked.paper);
          expect(sheet.fontPt, `${on}: the type size it set`) //
            .toBe(asked.fontPt);
        }
      }
    });

    it("carries the seed and the credit into the footer", () => {
      // The seed is what makes the same sheet printable again next week (§7);
      // the credit and the link back to the games are on every sheet there is
      // (§16, §19).
      for (const one of configs) {
        for (const seed of seeds) {
          const { footer } = buildSheet(one, seed);
          expect(footer.seed, `${where(one)}: the seed printed at the foot`) //
            .toBe(seed);
          expect(footer.credit, `${where(one)}: the credit`).toBe(SHEET_CREDIT);
          expect(footer.url ?? "", `${where(one)}: the way back to the games`) //
            .toContain(SHEET_URL);
        }
      }
    });

    it("names in one line what it prints", () => {
      // The catalog and the record of what a parent printed are both this
      // string, and both have one line to put it on.
      for (const one of configs) {
        const line = describeSheet(one);
        expect(line.trim(), `${kind}: describe() gave this config no name`) //
          .not.toBe("");
        expect(line, `${kind}: "${line}" is more than one line`) //
          .not.toContain("\n");
      }
    });

    it("prints the answers only when the sheet is a key", () => {
      for (const one of configs) {
        for (const seed of seeds) {
          expect(
            buildSheet(one, seed).answers,
            `${where(one)} at seed ${seed}: the sheet a child is given has the answers printed on it`,
          ).toBe(false);
        }
        if (!keyed(one)) continue;
        const key = answerKey(one, 5);
        expect(
          key.answers,
          `${where(one)}: this config withholds something, but its key does not print it`,
        ).toBe(true);
        expect(key.footer.note, `${where(one)}: what the key says it is`) //
          .toBe(KEY_NOTE);
      }
    });

    it("is the same sheet keyed, never a second generation", () => {
      // The key is the build, told to print what it already worked out — never
      // a second draw from the seed, which could answer a question the page
      // never asked (§7). So the two differ in the answers switch and in the
      // note at the foot, and in nothing else.
      for (const one of configs) {
        const sheet = buildSheet(one, 11);
        const key = answerKey(one, 11);
        expect(
          { ...key.footer, note: sheet.footer.note },
          `${where(one)}: the key changed the footer for more than to say what it is — the source credit belongs to the words on the page and prints on both`,
        ).toEqual(sheet.footer);
        expect(
          { ...key, answers: sheet.answers, footer: sheet.footer },
          `${where(one)}: the key is not the sheet it belongs to`,
        ).toEqual(sheet);
      }
    });

    it("marks a sheet out of a whole number, or does not mark it at all", () => {
      // "___ / 0" is what a score box counted from something nobody checked
      // looks like on paper. How many it should say is the family's business.
      for (const one of configs) {
        const score = buildSheet(one, 3).header.score;
        if (score === undefined) continue;
        expect(score.outOf, `${where(one)}: the score box`).toBeGreaterThan(0);
        expect(
          Number.isInteger(score.outOf),
          `${where(one)}: the score box says "/ ${score.outOf}"`,
        ).toBe(true);
      }
    });
  });
}
