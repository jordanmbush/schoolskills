import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CURSIVE } from "@/engine/sheets/hands/cursive";
import { PRINT } from "@/engine/sheets/hands/print";
import { contentBox } from "@/engine/sheets/layout";
import { DEFAULT_PAPER, rulePitch, writingSpace } from "@/engine/sheets/paper";
import type { Rule } from "@/engine/sheets/types";

import type { Forms } from "@/engine/sheets/hands/hand";

import type { SheetMetrics } from "./metrics";
import { WrittenRow, type WrittenCell } from "./Written";

const RULE: Rule = { style: "hand-5-8", midline: "dashed", descender: true };
const metrics: SheetMetrics = {
  box: contentBox(DEFAULT_PAPER),
  fontPt: 12,
  font: "print",
  answers: false,
};

const render = (cells: WrittenCell[], rule: Rule = RULE, forms?: Forms) =>
  renderToStaticMarkup(
    <WrittenRow
      rule={rule}
      metrics={metrics}
      hand={PRINT}
      cells={cells}
      forms={forms}
    />,
  );

const renderCursive = (cells: WrittenCell[]) =>
  renderToStaticMarkup(
    <WrittenRow
      rule={RULE}
      metrics={{ ...metrics, font: "cursive" }}
      hand={CURSIVE}
      cells={cells}
    />,
  );

const strokes = (html: string) => [
  ...html.matchAll(/<path class="sheet__stroke sheet__stroke--(\w+)"[^>]*>/g),
];

describe("WrittenRow", () => {
  it("draws one path per pen stroke, in the cell's style", () => {
    const html = render([
      { text: "a", style: "solid" },
      { text: "a", style: "dotted" },
    ]);
    const drawn = strokes(html);
    expect(drawn).toHaveLength(2 * PRINT.glyphs.a.strokes.length);
    expect(drawn.filter((m) => m[1] === "solid")).toHaveLength(2);
    expect(drawn.filter((m) => m[1] === "dotted")).toHaveLength(2);
  });

  it("dots and dashes are attributes in mil, and hollow is half the weight", () => {
    const html = render([
      { text: "l", style: "solid" },
      { text: "l", style: "hollow" },
      { text: "l", style: "dotted" },
      { text: "l", style: "dashed" },
    ]);
    const [solid, hollow, dotted, dashed] = strokes(html).map((m) => m[0]);
    const weight = (tag: string) =>
      Number(tag.match(/stroke-width="([\d.]+)"/)?.[1]);
    expect(weight(hollow)).toBe(weight(solid) / 2);
    expect(solid).not.toContain("stroke-dasharray");
    expect(dotted).toMatch(/stroke-dasharray="0 \d+"/);
    expect(dashed).toMatch(/stroke-dasharray="\d+ \d+"/);
  });

  it("puts the tallest letter on the top line and a tail below the baseline", () => {
    const html = render([{ text: "l", style: "solid" }]);
    const d = html.match(/<path class="sheet__stroke[^"]*" d="([^"]*)"/)?.[1];
    const ys = (d?.match(/-?[\d.]+/g) ?? [])
      .map(Number)
      .filter((_, i) => i % 2);
    const pitch = rulePitch(RULE);
    const writing = writingSpace(RULE);
    // The ⅝ rule with a tail: top line at the tail-less pitch's start.
    expect(Math.min(...ys)).toBeCloseTo(pitch - writing - writing / 2, -1);
    expect(Math.max(...ys)).toBeCloseTo(pitch - writing / 2, -1);

    const tail = render([{ text: "g", style: "solid" }]);
    const tailD = tail.match(
      /<path class="sheet__stroke[^"]*" d="([^"]*)"/g,
    )?.[1];
    const tailYs = (tailD?.match(/-?[\d.]+/g) ?? [])
      .map(Number)
      .filter((_, i) => i % 2);
    expect(Math.max(...tailYs)).toBeGreaterThan(pitch - writing / 2);
  });

  it("carries guides on a model and on nothing else", () => {
    const model = render([{ text: "t", style: "solid", guides: true }]);
    expect(model.match(/<circle/g)).toHaveLength(PRINT.glyphs.t.strokes.length);
    expect(model.match(/sheet__guide-number/g)).toHaveLength(
      PRINT.glyphs.t.strokes.length,
    );
    expect(model).toContain(">1</text>");
    expect(model).toContain(">2</text>");
    // The stem is long enough for an arrow beside it; so is the crossbar.
    expect(model.match(/sheet__guide-line/g)).toHaveLength(2);
    expect(model.match(/sheet__guide-arrow/g)).toHaveLength(2);
    expect(render([{ text: "t", style: "dotted" }])).not.toContain("<circle");
  });

  it("puts the start dot on the stroke's first point", () => {
    const html = render([{ text: "l", style: "solid", guides: true }]);
    const d = html.match(
      /<path class="sheet__stroke[^"]*" d="M ([\d.]+) ([\d.]+)/,
    );
    const dot = html.match(/<circle cx="([\d.]+)" cy="([\d.]+)"/);
    expect(dot?.[1]).toBe(d?.[1]);
    expect(dot?.[2]).toBe(d?.[2]);
  });

  it("draws nothing for an empty place and says what the row is", () => {
    const html = render([
      { text: "gate", style: "solid" },
      { text: "", style: "none" },
    ]);
    expect(strokes(html)).toHaveLength(
      [..."gate"].reduce((n, c) => n + PRINT.glyphs[c].strokes.length, 0),
    );
    expect(html).toContain('aria-label="gate"');
    expect(render([{ text: "", style: "none" }])).toContain(
      'aria-label="A line to write on"',
    );
  });

  it("shrinks a word too wide for its cell rather than overrunning it", () => {
    const wide = render([{ text: "gate", style: "solid" }]);
    const cramped = render(
      Array.from({ length: 12 }, () => ({
        text: "gate",
        style: "solid" as const,
      })),
    );
    const firstX = (html: string) =>
      (html.match(/<path class="sheet__stroke[^"]*" d="([^"]*)"/g) ?? []).map(
        (tag) => Number(tag.match(/d="M ([\d.]+)/)?.[1]),
      );
    // In the cramped row every cell's first stroke starts inside its own cell.
    const cell = Math.floor(metrics.box.width / 12);
    const starts = firstX(cramped);
    const perCell =
      PRINT.glyphs.g.strokes.length +
      PRINT.glyphs.a.strokes.length +
      PRINT.glyphs.t.strokes.length +
      PRINT.glyphs.e.strokes.length;
    for (let i = 0; i < 12; i += 1) {
      const start = starts[i * perCell];
      expect(start).toBeGreaterThanOrEqual(i * cell);
      expect(start).toBeLessThan((i + 1) * cell);
    }
    // And the letters are smaller for it: the bowl of the `g` spans less.
    const span = (html: string) => {
      const d = html.match(/<path class="sheet__stroke[^"]*" d="([^"]*)"/)?.[1];
      const xs = (d?.match(/-?[\d.]+/g) ?? [])
        .map(Number)
        .filter((_, i) => !(i % 2));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(span(cramped)).toBeLessThan(span(wide));
  });

  it("writes every cell in the forms asked for", () => {
    const own = render([{ text: "at", style: "solid" }]);
    const other = render([{ text: "at", style: "solid" }], RULE, {
      a: "double",
      t: "straight",
    });
    expect(other).not.toBe(own);
    expect(strokes(other)).toHaveLength(4);
    // A straight t's stem is one line, three quarters of the writing space
    // tall, where the curved one's bends into a hook.
    const writing = writingSpace(RULE);
    const uprights = (html: string) =>
      [...html.matchAll(/d="M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)"/g)]
        .map((m) => m.slice(1).map(Number))
        .filter(([x1, y1, x2, y2]) => x1 === x2 && y2 - y1 > writing * 0.7);
    expect(uprights(other)).toHaveLength(1);
    expect(uprights(own)).toHaveLength(0);
    // A form the hand does not draw changes nothing.
    expect(
      render([{ text: "at", style: "solid" }], RULE, { e: "double" }),
    ).toBe(own);
  });

  it("writes a character the hand lacks as a space, not as nothing", () => {
    const html = render([{ text: "a@", style: "solid" }]);
    expect(strokes(html)).toHaveLength(PRINT.glyphs.a.strokes.length);
  });
});

describe("WrittenRow in a hand that joins", () => {
  it("writes a word as one line, then the dots and crossbars in order", () => {
    const html = renderCursive([{ text: "quit", style: "dotted" }]);
    const drawn = strokes(html);
    // One path for the joined line, one for the i's dot, one for the t's bar.
    expect(drawn).toHaveLength(3);
    const line = html.match(
      /<path class="sheet__stroke[^"]*" d="([^"]*)"/,
    )?.[1];
    // A join is one cubic between the letters, so the line never moves the
    // pen: one M, and nothing after it but the four drawing commands.
    expect(line?.match(/M /g)).toHaveLength(1);
  });

  it("writes a letter alone with its lead-in and its tail", () => {
    const html = renderCursive([{ text: "i", style: "solid" }]);
    const line = html.match(
      /<path class="sheet__stroke[^"]*" d="([^"]*)"/,
    )?.[1];
    const alone = CURSIVE.glyphs.i.strokes[0];
    expect((line?.match(/ [LCQ] /g) ?? []).length).toBe(
      (alone.match(/ [LCQ] /g) ?? []).length,
    );
  });

  it("numbers a joined pair as one stroke and its marks", () => {
    const html = renderCursive([{ text: "in", style: "solid", guides: true }]);
    expect(html.match(/<circle/g)).toHaveLength(2);
    expect(html).toContain(">1</text>");
    expect(html).toContain(">2</text>");
    expect(html).not.toContain(">3</text>");
  });

  it("lifts the pen at a mark and at a space", () => {
    const marked = renderCursive([{ text: "a.b", style: "solid" }]);
    // a alone, the stop, b alone: three units, four paths with none joined.
    expect(strokes(marked)).toHaveLength(3);
    const spaced = renderCursive([{ text: "a b", style: "solid" }]);
    expect(strokes(spaced)).toHaveLength(2);
    expect(
      strokes(renderCursive([{ text: "ab", style: "solid" }])),
    ).toHaveLength(1);
  });
});
