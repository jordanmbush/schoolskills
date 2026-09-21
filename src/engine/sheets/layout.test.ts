import { describe, expect, it } from "vitest";

import {
  MAX_COUNT,
  blockBox,
  capacity,
  columnWidth,
  contentBox,
  countOf,
  fitAcross,
  paged,
  problemPages,
  ruleCapacity,
  ruledLines,
  wantedOf,
} from "./layout";
import { MARGINS, RULINGS, inches, rulePitch, toInches } from "./paper";
import type { MarginSize, Paper, PaperSize, Problem, Rule } from "./types";

const MARGIN_SIZES = Object.keys(MARGINS) as MarginSize[];

const paper = (size: PaperSize, margin: MarginSize): Paper => ({
  size,
  orientation: "portrait",
  margin,
});

/** The rule sets on a page, measured the way a ruler would: line to line. */
const gaps = (values: number[]) =>
  values.slice(1).map((value, i) => value - values[i]);

describe("boxes", () => {
  it("takes the margin off all four sides", () => {
    expect(contentBox(paper("letter", "normal"))).toEqual({
      x: 500,
      y: 500,
      width: 7500,
      height: 10000,
    });
    expect(contentBox(paper("letter", "none"))).toEqual({
      x: 0,
      y: 0,
      width: 8500,
      height: 11000,
    });
  });

  it("hands blocks what the header and footer left them", () => {
    const box = blockBox(paper("letter", "normal"), {
      header: 1000,
      footer: 500,
    });
    expect(box).toEqual({ x: 500, y: 1500, width: 7500, height: 8500 });
  });

  it("never returns a negative box, however greedy the chrome is", () => {
    const box = blockBox(paper("letter", "wide"), { header: 99_000 });
    expect(box.height).toBe(0);
  });
});

describe("rule geometry", () => {
  it("keeps a ⅝ rule 0.625in top line to baseline, on Letter and A4, at every margin", () => {
    // The assertion the whole unit choice exists for. An off-by-one in a
    // repeat is invisible on screen and obvious on paper, and a child taught
    // to write between two lines finds it before an adult does.
    for (const size of ["letter", "a4"] as PaperSize[]) {
      for (const margin of MARGIN_SIZES) {
        for (const descender of [true, false]) {
          const rule: Rule = { style: "hand-5-8", descender };
          const box = contentBox(paper(size, margin));
          const lines = ruledLines(box, rule);
          const bases = lines.filter((l) => l.role === "base").map((l) => l.y);
          // Each set's top line is a repeat down from the first. Without a
          // tail it is also the previous set's baseline, drawn once, so the
          // top lines cannot simply be counted off.
          const top = (set: number) => box.y + set * rulePitch(rule);

          expect(bases.length).toBe(ruleCapacity(box.height, rule));
          expect(bases.length).toBeGreaterThan(5);
          for (let i = 0; i < bases.length; i++) {
            expect(bases[i] - top(i)).toBe(625);
            expect(toInches(bases[i] - top(i))).toBeCloseTo(0.625, 6);
          }
          // Baselines are a repeat apart: ⅝, or with a tail under every set
          // 15/16 — the tail is added under the writing space, never taken
          // out of it.
          for (const gap of gaps(bases))
            expect(gap).toBe(descender ? 938 : 625);
        }
      }
    }
  });

  it("spaces every other ruling at its own pitch too, on both stocks", () => {
    for (const size of ["letter", "a4"] as PaperSize[]) {
      for (const margin of MARGIN_SIZES) {
        for (const ruling of Object.values(RULINGS)) {
          if (ruling.pitch === 0 || ruling.grid) continue;
          const box = contentBox(paper(size, margin));
          const tops = ruledLines(box, { style: ruling.id })
            .filter((line) => line.role !== "mid")
            .map((line) => line.y);
          for (const gap of gaps(tops)) expect(gap).toBe(ruling.pitch);
        }
      }
    }
  });

  it("keeps every line inside the box it was given", () => {
    for (const size of ["letter", "a4", "legal"] as PaperSize[]) {
      for (const margin of MARGIN_SIZES) {
        const box = contentBox(paper(size, margin));
        for (const line of ruledLines(box, { style: "hand-5-8" })) {
          expect(line.y).toBeGreaterThanOrEqual(box.y);
          expect(line.y).toBeLessThanOrEqual(box.y + box.height);
        }
      }
    }
  });

  it("draws a shared line once when there is no descender space", () => {
    // One set's baseline is the next set's top line. Two strokes at the same
    // y print as one heavy line — fine on screen, wrong on paper.
    const box = { x: 0, y: 0, width: 7500, height: inches(5) };
    const lines = ruledLines(box, { style: "hand-5-8" });
    expect(new Set(lines.map((line) => line.y)).size).toBe(lines.length);
    // Eight repeats: a top and a base each, sharing seven of them, plus a
    // midline apiece.
    expect(ruleCapacity(box.height, { style: "hand-5-8" })).toBe(8);
    expect(lines).toHaveLength(8 * 2 + 1);
  });

  it("counts no repeats at all on blank paper", () => {
    expect(ruleCapacity(inches(10), { style: "blank" })).toBe(0);
    expect(
      ruledLines(contentBox(paper("letter", "normal")), { style: "blank" }),
    ).toEqual([]);
  });
});

describe("capacity", () => {
  it("counts n cells and n − 1 gaps", () => {
    expect(fitAcross(1000, 300, 0)).toBe(3);
    // 3 × 300 + 2 × 50 = 1000 exactly; a fourth would need 1350.
    expect(fitAcross(1000, 300, 50)).toBe(3);
    expect(fitAcross(1349, 300, 50)).toBe(3);
    expect(fitAcross(1350, 300, 50)).toBe(4);
  });

  it("fits nothing rather than dividing by zero", () => {
    expect(fitAcross(1000, 0)).toBe(0);
    expect(fitAcross(0, 300)).toBe(0);
    expect(fitAcross(-500, 300)).toBe(0);
  });

  it("never returns more than fits, at any stock, margin or cell size", () => {
    // The capacity promise in §20. A row too many is a row that prints on a
    // second page nobody asked for.
    for (const size of ["letter", "a4", "legal"] as PaperSize[]) {
      for (const margin of MARGIN_SIZES) {
        for (const orientation of ["portrait", "landscape"] as const) {
          const box = contentBox({ size, orientation, margin });
          for (const cell of [
            { width: 900, height: 400 },
            { width: 2500, height: 1000 },
            { width: 7000, height: 300 },
          ]) {
            const gap = { x: 100, y: 60 };
            const { columns, rows } = capacity(box, cell, gap);
            expect(
              columns * cell.width + (columns - 1) * gap.x,
            ).toBeLessThanOrEqual(box.width);
            expect(rows * cell.height + (rows - 1) * gap.y).toBeLessThanOrEqual(
              box.height,
            );
          }
        }
      }
    }
  });

  it("splits a fixed column count without overflowing the box", () => {
    const box = contentBox(paper("letter", "normal"));
    for (const columns of [1, 2, 3, 4, 5]) {
      const width = columnWidth(box, columns, 100);
      expect(columns * width + (columns - 1) * 100).toBeLessThanOrEqual(
        box.width,
      );
    }
    expect(columnWidth(box, 0)).toBe(0);
  });

  it("reads a count as whole, never negative and never past the stepper", () => {
    expect(countOf(20)).toBe(20);
    expect(countOf(20.9)).toBe(20);
    expect(countOf(-3)).toBe(0);
    expect(countOf(Number.NaN)).toBe(0);
    // A bookmarked URL may ask for a million; the builder never can.
    expect(countOf(1_000_000)).toBe(MAX_COUNT);
  });

  it("draws the whole count unless not even one row fits", () => {
    // The page is not a ceiling — what does not fit runs on — but a row
    // taller than the paper is one no number of pages would mend.
    expect(wantedOf(40, 6)).toBe(40);
    expect(wantedOf(40, 0)).toBe(0);
    expect(wantedOf(40, -1)).toBe(0);
  });
});

describe("running on to another page", () => {
  const problem = (n: number): Problem => ({ prompt: `${n} =`, answer: "" });
  const twenty = Array.from({ length: 20 }, (_, i) => problem(i + 1));

  it("cuts a list at perPage with a break between the pages", () => {
    const blocks = paged(twenty, 6, (_page, from) => ({
      kind: "spacer",
      height: from,
    }));
    expect(blocks.map((block) => block.kind)).toEqual([
      "spacer",
      "break",
      "spacer",
      "break",
      "spacer",
      "break",
      "spacer",
    ]);
    // Told where each page starts, so a family can number on from there.
    expect(
      blocks.flatMap((block) =>
        block.kind === "spacer" ? [block.height] : [],
      ),
    ).toEqual([0, 6, 12, 18]);
  });

  it("never has fewer than one block, or more than one page with nothing on it", () => {
    // A sheet with nothing on it still prints its header, and needs a block
    // to be empty in — but not a break after it.
    expect(paged([], 6, () => ({ kind: "spacer", height: 0 }))).toEqual([
      { kind: "spacer", height: 0 },
    ]);
    // Exactly full is one page, not one page and an empty second.
    expect(paged(twenty, 20, () => ({ kind: "spacer", height: 0 })).length) //
      .toBe(1);
  });

  it("puts at least one item on a page however small perPage is", () => {
    // A family with nothing that fits draws nothing; a list that arrives
    // anyway is printed one to a page rather than thrown away.
    expect(paged(twenty, 0, () => ({ kind: "spacer", height: 0 })).length) //
      .toBe(39);
    expect(
      paged(twenty, Number.NaN, () => ({ kind: "spacer", height: 0 })).length,
    ) //
      .toBe(39);
  });

  it("numbers a page of problems on from where the page before stopped", () => {
    const blocks = problemPages(twenty, 3, 8);
    expect(blocks.map((block) => block.kind)).toEqual([
      "problems",
      "break",
      "problems",
      "break",
      "problems",
    ]);
    const pages = blocks.flatMap((block) =>
      block.kind === "problems" ? [block] : [],
    );
    expect(pages.map((page) => page.items.length)).toEqual([8, 8, 4]);
    expect(pages.map((page) => page.columns)).toEqual([3, 3, 3]);
    // Page one carries no `start`: absent is 1, and a block that said so
    // would be one that a key could differ from its sheet in.
    expect(pages.map((page) => page.start)).toEqual([undefined, 9, 17]);
    expect(pages.flatMap((page) => page.items)).toEqual(twenty);
  });
});
