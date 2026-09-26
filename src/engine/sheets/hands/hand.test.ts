import { describe, expect, it } from "vitest";

import { measure, tuckOf, type Drawing, type Hand } from "./hand";

const letter = (advance: number, extra: Partial<Drawing> = {}): Drawing => ({
  advance,
  strokes: ["M 0 0 L 10 10"],
  join: { lead: 1, tail: 1 },
  ...extra,
});

const hand = (glyphs: Record<string, Drawing>, tuck?: number): Hand => ({
  id: "test",
  name: "Test",
  units: 1000,
  ascent: 1000,
  xHeight: 500,
  descent: -500,
  space: 300,
  tuck,
  glyphs,
});

describe("how much closer a letter draws the next", () => {
  const a = letter(600);
  const t = letter(600, { overhang: 100 });
  const capital = letter(600, { join: { lead: 0, tail: 1, initial: true } });
  const space: Drawing = { advance: 300, strokes: [] };
  const mark: Drawing = { advance: 200, strokes: ["M 0 0 L 1 1"] };
  const capitalT = letter(1500, {
    join: undefined,
    overhang: 100,
  });
  const h = hand({ a, t }, 120);

  it("takes the tuck of a join between two letters that join", () => {
    expect(tuckOf(h, a, a)).toBe(120);
  });

  it("takes nothing where nothing joins", () => {
    expect(tuckOf(h, a, capital)).toBe(0);
    expect(tuckOf(h, a, undefined)).toBe(0);
    expect(tuckOf(h, undefined, a)).toBe(0);
  });

  it("takes the overhang before a small letter whether or not they join, and nothing before a capital, a mark or a space", () => {
    expect(tuckOf(h, t, a)).toBe(220);
    expect(tuckOf(h, capitalT, a)).toBe(100);
    expect(tuckOf(h, t, capital)).toBe(0);
    expect(tuckOf(h, t, mark)).toBe(0);
    expect(tuckOf(h, t, space)).toBe(0);
  });

  it("is nothing in a hand that sets no tuck", () => {
    expect(tuckOf(hand({ a }), a, a)).toBe(0);
  });

  it("adds the pull of a letter whose loop reaches left of its entry, only when a join arrives", () => {
    const j = letter(700, { pull: 140 });
    const pulled = hand({ a, j, capital }, 120);
    expect(tuckOf(pulled, a, j)).toBe(120 + 140);
    expect(tuckOf(pulled, capital, j)).toBe(120 + 140);
    expect(tuckOf(pulled, letter(600, { join: undefined }), j)).toBe(0);
    expect(tuckOf(pulled, a, a)).toBe(120);
  });

  it("takes back part of an overhang before the letters a pair names", () => {
    const bar = letter(600, { overhang: 100, kern: { t: 65 } });
    const bars = hand({ a, t: bar }, 120);
    expect(tuckOf(bars, bar, bar, "t")).toBe(120 + 100 - 65);
    expect(tuckOf(bars, bar, a, "a")).toBe(120 + 100);
    expect(tuckOf(bars, bar, a)).toBe(120 + 100);
  });
});

describe("how wide a word is", () => {
  const a = letter(600);
  const t = letter(600, { overhang: 100 });
  const h = hand({ a, t }, 120);

  it("counts each join and overhang once, and the last letter whole", () => {
    expect(measure(h, "aa")).toBe(600 + 600 - 120);
    expect(measure(h, "ta")).toBe(600 + 600 - 120 - 100);
    expect(measure(h, "at")).toBe(600 + 600 - 120);
  });

  it("counts a kern between the two letters it names", () => {
    const bar = letter(600, { overhang: 100, kern: { t: 65 } });
    expect(measure(hand({ a, t: bar }, 120), "tt")).toBe(600 + 600 - 155);
  });

  it("does not tuck a letter under an overhang across a space", () => {
    expect(measure(h, "t a")).toBe(600 + 300 + 600);
  });
});
