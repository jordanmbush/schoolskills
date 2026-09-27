import { describe, expect, it } from "vitest";

import { CURSIVE } from "@/engine/sheets/hands/cursive";
import { glyphOf, type Hand } from "@/engine/sheets/hands/hand";

import { parseStroke, placeStroke, type Segment } from "./glyphs";
import { joined, type Placed } from "./joined";

/**
 * Whether the looped hand's line flows: the pen never turns a little.
 *
 * A node is one of two things — a place the pen carries straight on, where the
 * two sides meet along one line, or a corner the pen really makes, the point
 * of an `i` or the top of a retraced stem, which turns a long way. A turn in
 * between is a kink drawn by accident (handles that do not line up, or a
 * short handle that rounding to whole units bent), and at pen width it reads
 * as a lump in the line.
 */
const CARRIES_ON = 2;
const CORNER = 45;

type Pt = { x: number; y: number };

const endOf = (s: Segment): Pt => ({
  x: s.points[s.points.length - 2],
  y: s.points[s.points.length - 1],
});

/** Unit tangents leaving the start and arriving at the end of a segment, skipping coincident handles. */
function tangents(s: Segment, from: Pt): { start: Pt; end: Pt } {
  const ctl: Pt[] = [from];
  for (let i = 0; i < s.points.length; i += 2)
    ctl.push({ x: s.points[i], y: s.points[i + 1] });
  const unit = (a: Pt, b: Pt): Pt | null => {
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    return l < 1e-9 ? null : { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  };
  let start: Pt | null = null;
  for (let i = 1; i < ctl.length && !start; i++) start = unit(ctl[0], ctl[i]);
  let end: Pt | null = null;
  for (let i = ctl.length - 2; i >= 0 && !end; i--)
    end = unit(ctl[i], ctl[ctl.length - 1]);
  return { start: start ?? { x: 1, y: 0 }, end: end ?? { x: 1, y: 0 } };
}

/** The turn, in degrees, at every node inside a stroke. */
function turns(stroke: Segment[]): Array<{ at: Pt; degrees: number }> {
  const out: Array<{ at: Pt; degrees: number }> = [];
  let at: Pt = { x: 0, y: 0 };
  let previous: { end: Pt } | null = null;
  for (const segment of stroke) {
    if (segment.type === "M") {
      at = endOf(segment);
      previous = null;
      continue;
    }
    const t = tangents(segment, at);
    if (previous) {
      const dot = Math.max(
        -1,
        Math.min(1, previous.end.x * t.start.x + previous.end.y * t.start.y),
      );
      out.push({ at, degrees: (Math.acos(dot) * 180) / Math.PI });
    }
    previous = { end: t.end };
    at = endOf(segment);
  }
  return out;
}

const accidental = (stroke: Segment[]) =>
  turns(stroke).filter((n) => n.degrees > CARRIES_ON && n.degrees < CORNER);

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function set(hand: Hand, text: string): Placed[] {
  let x = 0;
  return [...text].map((character) => {
    const glyph = glyphOf(hand, character)!;
    const origin = x;
    x += glyph.advance;
    return {
      strokes: glyph.strokes.map((s) => placeStroke(s, origin, 1000, 1)),
      join: glyph.join,
    };
  });
}

describe("the looped hand's flow", () => {
  it("has no accidental kink inside any drawn letter", () => {
    const found: string[] = [];
    for (const [character, glyph] of Object.entries(CURSIVE.glyphs)) {
      glyph.strokes.forEach((stroke, i) => {
        for (const n of accidental(parseStroke(stroke))) {
          found.push(
            `${character} stroke ${i} at ${Math.round(n.at.x)},${Math.round(n.at.y)}: ${n.degrees.toFixed(1)}°`,
          );
        }
      });
    }
    expect(found).toEqual([]);
  });

  it("joins every pair of small letters, and a capital and a small letter, without a kink", () => {
    const found: string[] = [];
    const pairs: string[] = [];
    for (const a of LOWER) for (const b of LOWER) pairs.push(a + b);
    for (const a of UPPER) for (const b of LOWER) pairs.push(a + b);
    for (const pair of pairs) {
      for (const unit of joined(set(CURSIVE, pair))) {
        for (const stroke of unit) {
          for (const n of accidental(stroke)) {
            found.push(
              `${pair} at ${Math.round(n.at.x)},${Math.round(n.at.y)}: ${n.degrees.toFixed(1)}°`,
            );
          }
        }
      }
    }
    expect(found).toEqual([]);
  });
});
