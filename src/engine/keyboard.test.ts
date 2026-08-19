import { describe, expect, it } from "vitest";

import { KEYS, KEY_ROWS, keyX, reachable, strokeFor } from "./keyboard";
import type { Finger, KeyDef } from "./keyboard";
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

/** Unshifted legend → the key that carries it. Word legends are not unique. */
const BY_LEGEND = new Map(
  KEYS.filter((k) => k.cap[0].length === 1).map((k) => [k.cap[0], k]),
);

/**
 * The finger assignment the module header claims, written out as data.
 *
 * Column by column, the way it is taught: the characters that column's finger
 * types, then the codes of the keys in it that type nothing. Spelling it out
 * here rather than reading it off `KEYS` is the point — this is the expected
 * value, and a one-character slip in the table has to disagree with it.
 */
const FINGERS: [Finger, string, ...string[]][] = [
  [
    "l-pinky",
    "`1qaz",
    "Tab",
    "CapsLock",
    "ShiftLeft",
    "ControlLeft",
    "MetaLeft",
  ],
  ["l-ring", "2wsx"],
  ["l-middle", "3edc"],
  ["l-index", "45rtfgvb"],
  ["thumb", " ", "AltLeft", "AltRight"],
  ["r-index", "67yuhjnm"],
  ["r-middle", "8ik,"],
  ["r-ring", "9ol."],
  [
    "r-pinky",
    "p0-=[]\\;'/",
    "Backspace",
    "Enter",
    "ShiftRight",
    "MetaRight",
    "ContextMenu",
    "ControlRight",
  ],
];

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

  it("puts a key's lane in the middle of it", () => {
    // `keyX` is Hailstorm's lane (§8.2), and what this pins is its agreement
    // with the layout table: every lane is `x` plus half the key's width, so a
    // field drawn from it and a board drawn from `KEY_ROWS` are reading the
    // same rows. Nothing here reads the board's CSS, so nothing here is a
    // claim about the drawn keycaps. Middle rather than left edge, which is
    // only visible on the keys that are not one unit wide.
    expect(keyX("KeyF")).toBe(5.25);
    expect(
      keyX("Space"),
      "6.25 units wide, so its edge is not its middle",
    ).toBe(6.875);

    // The example the design is written in: `y` is not above a home key, it is
    // between two of them, and that is what a child is being shown.
    expect(keyX("KeyY")).toBeGreaterThan(keyX("KeyG")!);
    expect(keyX("KeyY")).toBeLessThan(keyX("KeyH")!);

    for (const key of KEYS) {
      const x = keyX(key.code);
      expect(x, key.code).toBe(key.x + (key.width ?? 1) / 2);
      // The board is 15 units wide, so every lane is inside it — which is what
      // the field's `--key` arithmetic assumes and never checks.
      expect(x, key.code).toBeGreaterThan(0);
      expect(x, key.code).toBeLessThan(15);
    }
  });

  it("has no lane for a key it does not carry", () => {
    // A numpad key, a media key, or a `code` from a layout that is not US ANSI
    // (§3.4). Null rather than 0, which would be a lane on the far left.
    expect(keyX("Numpad7")).toBeNull();
    expect(keyX("AudioVolumeUp")).toBeNull();
    expect(keyX("IntlBackslash")).toBeNull();
  });

  it("keeps each row on one row number", () => {
    KEY_ROWS.forEach((row, n) => {
      for (const key of row) expect(key.row, key.code).toBe(n);
    });
  });

  it("resolves each key's own legends back to that key", () => {
    // The round-trip tests above walk *characters*, so they cannot see a
    // legend that appears twice: `STROKES` is first-writer-wins, so the second
    // key is silently shadowed and every one of those assertions still passes.
    // This walks keys instead, and asks the question the module exists to
    // answer — `code`, not `key`, so that the picture and the Hailstorm lane
    // light the switch that was actually pressed (docs/typing.md §3.2). A
    // shadowed key cannot answer for its own cap, and fails here.
    //
    // What no assertion in this file can catch is two keys whose legends are
    // swapped wholesale: that board is self-consistent, and only the finger
    // test below sees it — and only when the swap crosses a finger column.
    for (const key of KEYS) {
      const [unshifted, shifted] = key.cap;
      if (unshifted.length === 1) {
        const stroke = strokeFor(unshifted);
        expect(stroke?.code, `${key.code} → ${unshifted}`).toBe(key.code);
        expect(stroke?.shift, `${key.code} → ${unshifted}`).toBeNull();
      }
      // The space bar is the one key whose two caps are the same character,
      // so its shifted legend is the unshifted stroke. Every other pair
      // differs, and the shifted half must ask for a shift.
      if (shifted.length === 1 && shifted !== unshifted) {
        const stroke = strokeFor(shifted);
        expect(stroke?.code, `${key.code} → ${shifted}`).toBe(key.code);
        expect(stroke?.shift, `${key.code} → ${shifted}`).not.toBeNull();
      }
    }
  });

  it("puts every key on the finger the standard assignment gives it", () => {
    // The assignment is the thing being taught, and three consumers read it:
    // the curriculum's mirrored-pair ordering (§5.5), the next-key hint's
    // finger colour, and Hailstorm's eight shield zones (§8.5), where a wrong
    // finger puts the hole under the wrong hand. Nothing else in this file
    // would notice a typo — the opposite-hand test compares only the hand.
    const expected = new Map<string, Finger>();
    for (const [finger, legends, ...codes] of FINGERS) {
      for (const ch of legends) {
        const key = BY_LEGEND.get(ch);
        expect(key, ch).toBeDefined();
        expected.set(key!.code, finger);
      }
      for (const code of codes) expected.set(code, finger);
    }

    expect(expected.size, "every key is spoken for").toBe(KEYS.length);
    for (const key of KEYS) {
      expect(key.finger, key.code).toBe(expected.get(key.code));
    }
  });
});
