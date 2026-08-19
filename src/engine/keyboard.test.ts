import { describe, expect, it } from "vitest";

import { KEYS, KEY_ROWS, reachable, strokeFor } from "./keyboard";
import type { KeyDef } from "./keyboard";
import { TYPING_LEVELS } from "./decks/typing";

const BY_CODE = new Map(KEYS.map((k) => [k.code, k]));

/** What a stroke actually produces, read back off the key it names. */
const typed = (ch: string): string | null => {
  const stroke = strokeFor(ch);
  if (!stroke) return null;
  const key = BY_CODE.get(stroke.code);
  if (!key) return null;
  return stroke.shift ? key.cap[1] : key.cap[0];
};

/** Every character this board can produce, which is what the pools live off. */
const EVERYTHING = new Set(
  KEYS.flatMap((k) => k.cap).filter((legend) => legend.length === 1),
);

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
/** The punctuation the shipped typing pools use, plus what block 7 adds. */
const PUNCTUATION = "`-=[]\\;',./~!@#$%^&*()_+{}|:\"<>? ";

const hand = (key: KeyDef) => (key.finger.startsWith("l-") ? "l" : "r");

describe("strokeFor", () => {
  it("round-trips every letter, in both cases", () => {
    for (const ch of LETTERS + LETTERS.toUpperCase()) {
      expect(typed(ch), ch).toBe(ch);
    }
  });

  it("round-trips every digit and every shipped punctuation mark", () => {
    for (const ch of DIGITS + PUNCTUATION) {
      expect(typed(ch), ch).toBe(ch);
    }
  });

  it("round-trips everything the board can produce", () => {
    // The two lists above are what we meant to ship; this is what the table
    // actually carries. A key added with a legend nobody can type would slip
    // past the named lists and be caught here.
    for (const ch of EVERYTHING) {
      expect(typed(ch), ch).toBe(ch);
    }
  });

  it("leaves a plain character unshifted", () => {
    expect(strokeFor("a")).toEqual({
      code: "KeyA",
      shift: null,
      finger: "l-pinky",
    });
    expect(strokeFor(" ")).toEqual({
      code: "Space",
      shift: null,
      finger: "thumb",
    });
  });

  it("takes the shift on the opposite hand", () => {
    // The whole point of returning a *specific* shift: left pinky on shift and
    // left pinky on `a` is not a thing hands can do.
    expect(strokeFor("A")).toEqual({
      code: "KeyA",
      shift: "ShiftRight",
      finger: "l-pinky",
    });
    expect(strokeFor(":")).toEqual({
      code: "Semicolon",
      shift: "ShiftLeft",
      finger: "r-pinky",
    });
    expect(strokeFor("$")).toEqual({
      code: "Digit4",
      shift: "ShiftRight",
      finger: "l-index",
    });
  });

  it("never asks one hand to hold shift and press the key", () => {
    for (const ch of EVERYTHING) {
      const stroke = strokeFor(ch)!;
      if (!stroke.shift) continue;
      const key = BY_CODE.get(stroke.code)!;
      expect(stroke.shift, ch).toBe(
        hand(key) === "l" ? "ShiftRight" : "ShiftLeft",
      );
    }
  });

  it("returns null for a character this layout cannot produce", () => {
    // The curly quotation marks in the Bible release, which decks/typing.ts
    // had to hand-exclude from the Scripture pool. A verse carrying one is
    // unpassable rather than hard, because typing marks exactly.
    expect(strokeFor("“")).toBeNull();
    expect(strokeFor("”")).toBeNull();
    expect(strokeFor("’")).toBeNull();
    expect(strokeFor("—")).toBeNull();
    expect(strokeFor("é")).toBeNull();
  });

  it("does not answer for a key that types nothing", () => {
    for (const legend of ["Tab", "Shift", "Caps", "Enter", "Bksp", "Ctrl"]) {
      expect(strokeFor(legend), legend).toBeNull();
    }
  });
});

describe("reachable", () => {
  it("passes text made only of unlocked characters", () => {
    const homeRow = new Set([..."asdfghjkl", " "]);
    expect(reachable("a glass flask", homeRow)).toBe(true);
  });

  it("fails on a character the child has not been given yet", () => {
    const homeRow = new Set([..."asdfghjkl", " "]);
    expect(reachable("glad we met", homeRow)).toBe(false);
    // Unlocking `a` does not hand a child `A` — shift is its own lesson.
    expect(reachable("Ask", homeRow)).toBe(false);
  });

  it("fails on a character the board cannot produce, however unlocked", () => {
    // Both halves of the check matter: a curly quote in a set of unlocked
    // characters is still a key nobody has.
    expect(reachable("“yes”", new Set([..."“yes”"]))).toBe(false);
  });

  it("is true of empty text", () => {
    expect(reachable("", new Set())).toBe(true);
  });

  for (const level of TYPING_LEVELS) {
    it(`can type every character of the ${level.id} pool`, () => {
      // The levels that ship today, against the board as it is. This is the
      // check that would have caught the curly quotation marks by itself.
      for (const entry of level.pool) {
        expect(reachable(entry, EVERYTHING), entry).toBe(true);
      }
    });
  }
});

describe("the board", () => {
  it("gives every key a unique code", () => {
    expect(BY_CODE.size).toBe(KEYS.length);
  });

  it("puts the fingers on eight home keys and the space bar", () => {
    expect(KEYS.filter((k) => k.home).map((k) => k.code)).toEqual([
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyF",
      "KeyJ",
      "KeyK",
      "KeyL",
      "Semicolon",
      "Space",
    ]);
  });

  it("lays every row out end to end, 15 units wide", () => {
    // `x` is stored per key rather than computed, so a typo in the table is a
    // silently overlapping key — and in Hailstorm, a letter falling down the
    // wrong column. This is the arithmetic nobody has to do at runtime.
    for (const row of KEY_ROWS) {
      let edge = 0;
      for (const key of row) {
        expect(key.x, key.code).toBe(edge);
        edge += key.width ?? 1;
      }
      expect(edge, `row ${row[0].row}`).toBe(15);
    }
  });

  it("keeps each row on one row number", () => {
    KEY_ROWS.forEach((row, n) => {
      for (const key of row) expect(key.row, key.code).toBe(n);
    });
  });
});
