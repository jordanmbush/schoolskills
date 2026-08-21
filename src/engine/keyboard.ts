/**
 * The physical keyboard, as data.
 *
 * In the engine and not the view because three of its four consumers are not
 * pictures — the curriculum, the generator's `reachable()`, and Hailstorm's
 * lanes (§3.1, decision 1). Only the fourth draws it, and putting the layout
 * there would make the other three import upwards.
 *
 * US ANSI QWERTY and nothing else: a real limit, written down rather than
 * discovered, and a cheap one to lift (§3.4, decision 26).
 */

/**
 * Which finger presses a key, in touch-typing's standard assignment.
 *
 * `thumb` is one finger rather than two: either thumb will do for the space bar
 * and the two Alts, and nothing downstream needs to know which.
 */
export type Finger =
  | "l-pinky"
  | "l-ring"
  | "l-middle"
  | "l-index"
  | "thumb"
  | "r-index"
  | "r-middle"
  | "r-ring"
  | "r-pinky";

export type KeyDef = {
  /**
   * `KeyboardEvent.code`. "KeyF", "Semicolon", "Digit4", "Space".
   *
   * `code`, not `key`: shift+`4` produces `$` and there is no `$` key to light
   * (§3.2).
   */
  code: string;
  /**
   * Unshifted and shifted legends: ["a","A"], ["4","$"], ["/","?"].
   *
   * A key that produces no character carries a word — "Tab", "Shift", "Bksp" —
   * never a glyph like "⌫". `strokeFor` indexes only the single-character
   * legends, so a word legend is what keeps a modifier out of "which key types
   * this?" without a second field to exclude it.
   */
  cap: [string, string];
  /** 0 = number row, 1 = top, 2 = home, 3 = bottom, 4 = space. */
  row: 0 | 1 | 2 | 3 | 4;
  finger: Finger;
  /** True for a s d f — j k l ; and the space bar. Where the fingers rest. */
  home?: boolean;
  /** Width in key units. 1 unless it is a modifier or the space bar. */
  width?: number;
  /** Left edge in key units, from the left edge of the board. */
  x: number;
};

/**
 * One row's worth of keys, left to right.
 *
 * `x` is written down rather than accumulated: the row stagger is a fact about
 * the plastic and is derivable from nothing (§3.2).
 */
const key = (
  code: string,
  cap: [string, string],
  row: KeyDef["row"],
  finger: Finger,
  x: number,
  extra?: { home?: true; width?: number },
): KeyDef => ({ code, cap, row, finger, x, ...extra });

/**
 * The board, as rows — 15 key units wide, which is what the view scales off a
 * single `--key` custom property and what Hailstorm measures its lanes in.
 *
 * The finger assignment is touch-typing's standard one, and it is the thing
 * being taught: written per key here rather than inferred from `x`.
 */
export const KEY_ROWS: KeyDef[][] = [
  // Row 0 — the number row.
  [
    key("Backquote", ["`", "~"], 0, "l-pinky", 0),
    key("Digit1", ["1", "!"], 0, "l-pinky", 1),
    key("Digit2", ["2", "@"], 0, "l-ring", 2),
    key("Digit3", ["3", "#"], 0, "l-middle", 3),
    key("Digit4", ["4", "$"], 0, "l-index", 4),
    key("Digit5", ["5", "%"], 0, "l-index", 5),
    key("Digit6", ["6", "^"], 0, "r-index", 6),
    key("Digit7", ["7", "&"], 0, "r-index", 7),
    key("Digit8", ["8", "*"], 0, "r-middle", 8),
    key("Digit9", ["9", "("], 0, "r-ring", 9),
    key("Digit0", ["0", ")"], 0, "r-pinky", 10),
    key("Minus", ["-", "_"], 0, "r-pinky", 11),
    key("Equal", ["=", "+"], 0, "r-pinky", 12),
    key("Backspace", ["Bksp", "Bksp"], 0, "r-pinky", 13, { width: 2 }),
  ],
  // Row 1 — the top row.
  [
    key("Tab", ["Tab", "Tab"], 1, "l-pinky", 0, { width: 1.5 }),
    key("KeyQ", ["q", "Q"], 1, "l-pinky", 1.5),
    key("KeyW", ["w", "W"], 1, "l-ring", 2.5),
    key("KeyE", ["e", "E"], 1, "l-middle", 3.5),
    key("KeyR", ["r", "R"], 1, "l-index", 4.5),
    key("KeyT", ["t", "T"], 1, "l-index", 5.5),
    key("KeyY", ["y", "Y"], 1, "r-index", 6.5),
    key("KeyU", ["u", "U"], 1, "r-index", 7.5),
    key("KeyI", ["i", "I"], 1, "r-middle", 8.5),
    key("KeyO", ["o", "O"], 1, "r-ring", 9.5),
    key("KeyP", ["p", "P"], 1, "r-pinky", 10.5),
    key("BracketLeft", ["[", "{"], 1, "r-pinky", 11.5),
    key("BracketRight", ["]", "}"], 1, "r-pinky", 12.5),
    key("Backslash", ["\\", "|"], 1, "r-pinky", 13.5, { width: 1.5 }),
  ],
  // Row 2 — home. The eight keys the hands are put on and returned to.
  [
    key("CapsLock", ["Caps", "Caps"], 2, "l-pinky", 0, { width: 1.75 }),
    key("KeyA", ["a", "A"], 2, "l-pinky", 1.75, { home: true }),
    key("KeyS", ["s", "S"], 2, "l-ring", 2.75, { home: true }),
    key("KeyD", ["d", "D"], 2, "l-middle", 3.75, { home: true }),
    key("KeyF", ["f", "F"], 2, "l-index", 4.75, { home: true }),
    key("KeyG", ["g", "G"], 2, "l-index", 5.75),
    key("KeyH", ["h", "H"], 2, "r-index", 6.75),
    key("KeyJ", ["j", "J"], 2, "r-index", 7.75, { home: true }),
    key("KeyK", ["k", "K"], 2, "r-middle", 8.75, { home: true }),
    key("KeyL", ["l", "L"], 2, "r-ring", 9.75, { home: true }),
    key("Semicolon", [";", ":"], 2, "r-pinky", 10.75, { home: true }),
    key("Quote", ["'", '"'], 2, "r-pinky", 11.75),
    key("Enter", ["Enter", "Enter"], 2, "r-pinky", 12.75, { width: 2.25 }),
  ],
  // Row 3 — the bottom row, and the two shifts.
  [
    key("ShiftLeft", ["Shift", "Shift"], 3, "l-pinky", 0, { width: 2.25 }),
    key("KeyZ", ["z", "Z"], 3, "l-pinky", 2.25),
    key("KeyX", ["x", "X"], 3, "l-ring", 3.25),
    key("KeyC", ["c", "C"], 3, "l-middle", 4.25),
    key("KeyV", ["v", "V"], 3, "l-index", 5.25),
    key("KeyB", ["b", "B"], 3, "l-index", 6.25),
    key("KeyN", ["n", "N"], 3, "r-index", 7.25),
    key("KeyM", ["m", "M"], 3, "r-index", 8.25),
    key("Comma", [",", "<"], 3, "r-middle", 9.25),
    key("Period", [".", ">"], 3, "r-ring", 10.25),
    key("Slash", ["/", "?"], 3, "r-pinky", 11.25),
    key("ShiftRight", ["Shift", "Shift"], 3, "r-pinky", 12.25, { width: 2.75 }),
  ],
  // Row 4 — the space bar, and the modifiers nothing here types with.
  [
    key("ControlLeft", ["Ctrl", "Ctrl"], 4, "l-pinky", 0, { width: 1.25 }),
    key("MetaLeft", ["Cmd", "Cmd"], 4, "l-pinky", 1.25, { width: 1.25 }),
    key("AltLeft", ["Alt", "Alt"], 4, "thumb", 2.5, { width: 1.25 }),
    key("Space", [" ", " "], 4, "thumb", 3.75, { home: true, width: 6.25 }),
    key("AltRight", ["Alt", "Alt"], 4, "thumb", 10, { width: 1.25 }),
    key("MetaRight", ["Cmd", "Cmd"], 4, "r-pinky", 11.25, { width: 1.25 }),
    key("ContextMenu", ["Menu", "Menu"], 4, "r-pinky", 12.5, { width: 1.25 }),
    key("ControlRight", ["Ctrl", "Ctrl"], 4, "r-pinky", 13.75, { width: 1.25 }),
  ],
];

/** Every key on the board, rows flattened. Row order is left-to-right, top-down. */
export const KEYS: KeyDef[] = KEY_ROWS.flat();

/** `code` → its key. Built once; the table above is a constant. */
const BY_CODE = new Map(KEYS.map((k) => [k.code, k]));

/**
 * The key a `KeyboardEvent.code` names, or `null` for one this board does not
 * carry — a numpad key, a media key, `F7`, or anything from a layout that is
 * not US ANSI (§3.4).
 *
 * The `null` is the useful half. "Is this code on the board?" is asked for
 * reasons that have nothing to do with geometry — the clack plays only for keys
 * the picture draws (§4.8) — and `keyX(code) !== null` would answer it by
 * reading a horizontal position. Same lookup, one name for it.
 */
export function keyFor(code: string): KeyDef | null {
  return BY_CODE.get(code) ?? null;
}

/**
 * Where a key sits across the board: the middle of it, in key units, or `null`
 * for a code this board does not carry (§3.4).
 *
 * The board is 15 units wide, so this is a number from 0 to 15 that scales off
 * the same single `--key` the picture does. Hailstorm's lanes are this function
 * (§3.2, §8.2, decision 19).
 *
 * The **middle** rather than the left edge, because a falling glyph is centred
 * on its column and the wide keys are where the difference shows: the space bar
 * is 6.25 units, so its edge and its middle are three keys apart.
 */
export function keyX(code: string): number | null {
  const key = keyFor(code);
  return key ? key.x + (key.width ?? 1) / 2 : null;
}

/**
 * The board's home row: the eight keys the hands rest on, plus the keys
 * outboard of them that the two pinkies also cover.
 *
 * A row index rather than `KeyDef.home`, which marks only the eight resting
 * keys and the space bar — `Caps`, `'` and `Enter` are on this row and belong
 * to a pinky, and a zone drawn without them would stop short of the edge of
 * the board it is supposed to span.
 */
const HOME_ROW: KeyDef["row"] = 2;

/** A stretch of the board, in the key units everything else here is in. */
export type FingerZone = {
  /** Left edge in key units, from the left edge of the board. */
  x: number;
  /** Width in key units. The board is 15 of them wide. */
  width: number;
};

/**
 * How much of the board each finger is responsible for, in key units: each
 * finger's home-row span, which is a choice between four staggered rows rather
 * than a derivation (§8.5, decision 41). Hailstorm's shield is these eight.
 *
 * Here rather than in the component that draws that shield, for the same reason
 * `keyX` is here — a second opinion about which keys the right ring finger
 * covers would put the hole over the wrong hand.
 *
 * The thumbs have no zone: nothing falls on the space bar (§8.3), and the home
 * row carries no thumb key for the cast below to have to exclude.
 */
export const FINGER_ZONES: Readonly<
  Record<Exclude<Finger, "thumb">, FingerZone>
> = (() => {
  const zones: Partial<Record<Finger, FingerZone>> = {};

  for (const key of KEYS) {
    if (key.row !== HOME_ROW) continue;
    const right = key.x + (key.width ?? 1);
    const seen = zones[key.finger];
    const left = seen ? Math.min(seen.x, key.x) : key.x;
    zones[key.finger] = {
      x: left,
      width: (seen ? Math.max(seen.x + seen.width, right) : right) - left,
    };
  }

  // Eight, because the home row carries no thumb key and every other finger
  // has at least one on it. Both halves are the table's to keep and the
  // board tests' to check, so this asserts rather than proves.
  return zones as Record<Exclude<Finger, "thumb">, FingerZone>;
})();

/**
 * What to call a finger out loud, for the one screen that has to name one:
 * Hailstorm's ending says which finger let a letter through (§8.5).
 *
 * Here rather than in the component that renders the sentence, for the same
 * reason `FINGER_ZONES` is here — the id and the name are one fact about the
 * hands. Lowercase and plain because each is a fragment a sentence is built
 * around ("Your ___ let two through"), so the caller supplies the capital.
 *
 * **Little finger, not pinky**, and index rather than pointing: the rest of
 * this site is written in British English, and these are the words a UK
 * five-year-old is taught to name their own hand with.
 *
 * No thumb. It is the one entry in `Finger` that is not a finger of one hand,
 * so there is no "left" or "right" to say, and the shield has no thumb segment
 * (§8.5) — which leaves the eight zones and the eight names the same eight,
 * checked by the compiler rather than by a reader.
 */
export const FINGER_NAMES: Readonly<Record<Exclude<Finger, "thumb">, string>> =
  {
    "l-pinky": "left little finger",
    "l-ring": "left ring finger",
    "l-middle": "left middle finger",
    "l-index": "left index finger",
    "r-index": "right index finger",
    "r-middle": "right middle finger",
    "r-ring": "right ring finger",
    "r-pinky": "right little finger",
  };

export type Stroke = {
  /** The letter key. */
  code: string;
  /** Which shift to hold, or null. Always the hand OPPOSITE `code`. */
  shift: "ShiftLeft" | "ShiftRight" | null;
  /** The finger that presses `code`. The shift is always a pinky. */
  finger: Finger;
};

/**
 * The shift on the other hand from this finger — the technique the hint teaches
 * rather than merely locating the key (§3.3).
 *
 * `thumb` falls to the same branch as the right hand and never reaches it: no
 * thumb key carries a single-character *shifted* legend — the space bar's two
 * caps are both a space, and the Alts are words — so no thumb stroke ever needs
 * a shift. The choice is only ever about two hands.
 */
const oppositeShift = (finger: Finger): "ShiftLeft" | "ShiftRight" =>
  finger.startsWith("l-") ? "ShiftRight" : "ShiftLeft";

/**
 * Character → the stroke that produces it, built once from the table above.
 *
 * Only single-character legends are indexed, which is what keeps "Tab" and
 * "Shift" out of it. First writer wins: no legend appears twice on this board,
 * and a second key carrying one would be shadowed here rather than rejected.
 * The round-trip tests cannot see that — they walk characters, and a shadowed
 * key never comes up. What rules it out is the key-side test, "resolves each
 * key's own legends back to that key", which walks the board in this direction
 * instead: a shadowed key does not answer for its own cap, and fails.
 */
const STROKES = new Map<string, Stroke>();
for (const k of KEYS) {
  const [unshifted, shifted] = k.cap;
  if (unshifted.length === 1 && !STROKES.has(unshifted))
    STROKES.set(unshifted, { code: k.code, shift: null, finger: k.finger });
  if (shifted.length === 1 && !STROKES.has(shifted))
    STROKES.set(shifted, {
      code: k.code,
      shift: oppositeShift(k.finger),
      finger: k.finger,
    });
}

/**
 * How to type one character, or `null` if this layout cannot produce it.
 *
 * That null is load-bearing rather than defensive: `reachable()` is built out
 * of it (§3.3).
 */
export function strokeFor(ch: string): Stroke | null {
  return STROKES.get(ch) ?? null;
}

/**
 * Can every character of `text` be typed with the keys unlocked so far?
 *
 * `keys` is the unlocked *alphabet* — the characters those keys produce, which
 * is the form a lesson declares (`Lesson.introduces`) and the form the ladder
 * accumulates. A capital is its own entry because shift is its own lesson:
 * unlocking `a` does not hand a child `A`.
 *
 * Both halves matter. The `keys` check is the curriculum's — don't use a key
 * they haven't met. The `strokeFor` check is the layout's — don't use a
 * character this board cannot produce at all (§5.2).
 */
export function reachable(text: string, keys: ReadonlySet<string>): boolean {
  for (const ch of text) {
    if (!keys.has(ch)) return false;
    if (!strokeFor(ch)) return false;
  }
  return true;
}
