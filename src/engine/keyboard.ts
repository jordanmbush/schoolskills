/**
 * The physical keyboard, as data.
 *
 * A *picture* of a keyboard belongs in the view. The keyboard itself does not,
 * because three of its four consumers are not pictures (docs/typing.md §3.1):
 *
 *   - The **curriculum** needs to know that `e` is the left middle finger on
 *     the top row, so "introduce one key per hand" is a rule the lesson list
 *     can be checked against rather than a claim in a comment.
 *   - The **generator** needs `reachable()` — is every character of this word
 *     producible from the keys unlocked so far? That is the invariant which
 *     makes a hundred lessons safe to re-order (§5.2), and it is a pure
 *     function over this table.
 *   - **Hailstorm** needs a key's horizontal position, because that is the lane
 *     its letter falls down (§8.2): `f` falls onto `f`, and `y` falls between
 *     `g` and `h` because that is where `y` is. The game is not themed around a
 *     keyboard, it is teaching the layout geometrically the whole time.
 *
 * Only the fourth consumer draws it. Put the layout in the view and the other
 * three have to import upwards, which the lint boundary correctly forbids.
 *
 * ── US ANSI QWERTY, and nothing else ─────────────────────────────────────────
 * The site is `en` and typing marks punctuation exactly, so a UK board — where
 * `"` is shift-`2` and `@` is shift-`'` — would fail a punctuation lesson for a
 * child who is doing everything right. That is a real limitation and it is
 * written down here rather than discovered later. It is also a cheap one to
 * lift: the layout is data behind one function, so a second board is a second
 * table plus a profile field, and `strokeFor` is the only caller that would
 * have to learn about it (§3.4).
 */

/**
 * Which finger presses a key, in touch-typing's standard assignment.
 *
 * `thumb` is one finger rather than two because either thumb will do for the
 * keys it covers — the space bar and the two Alts — and nothing downstream
 * needs to know which.
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
   * `code`, not `key`. `KeyboardEvent.key` reports the character that was
   * produced, which is the wrong question for "light up the key that was
   * pressed": shift+`4` produces `$` and there is no `$` key to light. `code`
   * is the physical switch, which is exactly what the picture draws and
   * exactly what the falling-letter lane is a column of.
   */
  code: string;
  /**
   * Unshifted and shifted legends: ["a","A"], ["4","$"], ["/","?"].
   *
   * A key that produces no character carries a word — "Tab", "Shift", "Bksp" —
   * never a glyph like "⌫". `strokeFor` indexes the legends that are a single
   * character, so a word legend is what keeps a modifier out of the answer to
   * "which key types this?" without needing a second field to exclude it.
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
 * `x` is written down rather than accumulated because the row stagger is not
 * derivable from anything — it is a fact about the plastic. Row 1 starts a
 * third of a unit in, row 2 a little further, row 3 further still. Storing it
 * costs one number per key and leaves no arithmetic for anybody to trust.
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
 * Fingers are the standard assignment: the index fingers take two columns
 * each (`4 5 r t f g v b` on the left, `6 7 y u h j n m` on the right) and the
 * pinkies take everything outboard of `q a z` and `p ; /`. That is the thing
 * being taught, so it is written once here rather than inferred from `x`.
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
 * Where a key sits across the board: the middle of it, in key units.
 *
 * The board is 15 units wide, so this is a number from 0 to 15 that scales off
 * the same single `--key` custom property the picture of the keyboard does —
 * which is the point. Hailstorm's lanes are this function (docs/typing.md §8.2,
 * decision 19): a letter falls down the column of the key that produces it, so
 * `keyX("KeyF")` is where `f` falls and `keyX("KeyY")` lands between `g` and
 * `h` because that is where `y` is.
 *
 * The field and the drawn board cannot disagree about where a key is because
 * both read the same `KEY_ROWS` table and both measure in key units off that
 * one `--key`. It is one *table*, not one function: `keyX` is the field's
 * convenience for the centre of a key's slot, while the board wants a left
 * edge and a width and takes `KeyDef.x` / `KeyDef.width` straight from the
 * same rows without calling this. A lane half a unit out would be a spatial
 * hint that teaches the wrong thing, and the shared table is what rules that
 * out. The keycap drawn inside a slot is inset by `--key-gap`, so a slot's
 * centre and a cap's centre are 0.045 units apart — §8.2 has that number.
 *
 * The **middle** rather than the left edge, because a falling glyph is centred
 * on its column and the wide keys are where the difference shows: the space bar
 * is 6.25 units, so its edge and its middle are three keys apart.
 *
 * `null` for a code this board does not carry — a numpad key, a media key, or
 * anything from a layout that is not US ANSI (§3.4).
 */
export function keyX(code: string): number | null {
  const key = BY_CODE.get(code);
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
 * How much of the board each finger is responsible for, in key units.
 *
 * The second thing Hailstorm needs from this table, after the lane: its shield
 * is eight segments across the bottom of the field, one per finger, and each
 * one has to sit over the keys whose misses break it (docs/typing.md §8.5).
 * Here rather than in the component that draws it for the same reason `keyX`
 * is here — it is a fact about the plastic, and a second opinion about which
 * keys the right ring finger covers would put the hole over the wrong hand.
 *
 * ── The home row is the zone ────────────────────────────────────────────────
 * The eight spans are the home row's keys grouped by finger, and that is a
 * choice between four rows rather than a derivation. Every row divides into
 * eight runs — no row hands a key back to a finger it has already passed — but
 * the four rows do not agree about WHERE the divisions fall, because the rows
 * are staggered. The left pinky gives way to the left ring at 2 on the number
 * row, at 2.5 on the top row, at 2.75 on the home row and at 3.25 on the
 * bottom row. A vertical seam can honour one of those four, so the question
 * is which row's seams the shield is drawn on.
 *
 * The home row, because it is the row the hands are literally on: `a s d f`
 * and `j k l ;` is where a touch typist's fingers rest and what every reach
 * returns to, so "your right ring finger" and "the column over `l`" are the
 * same statement to the child being told it. The other rows are then off by
 * the stagger and no more — a key never sits further than a quarter unit
 * outside its own finger's zone, which is `keyboard.test.ts`'s to pin.
 *
 * The thumbs have no zone. Nothing falls on the space bar (§8.3), so the eight
 * here are exactly the eight the shield is divided into, and the home row
 * carries no thumb key for the cast below to have to exclude.
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
 * What to call a finger out loud, for the one screen that has to name one.
 *
 * Hailstorm's shield is eight finger zones, and when a letter gets through a
 * hole the run ends with the screen saying which finger let it in
 * (docs/typing.md §8.5). "Your right ring finger" is the entire value of that
 * feedback: it is a thing a child can look down at, and `r-ring` is not.
 *
 * Here rather than in the component that renders the sentence, for the same
 * reason `FINGER_ZONES` is here — the id and the name are one fact about the
 * hands, and a second opinion about which finger `r-ring` is would put the
 * blame on the wrong one. It is also why the words are plain and lowercase:
 * they are a fragment a sentence is built around ("Your ___ let two through"),
 * not a label, so the caller supplies the capital.
 *
 * **Little finger, not pinky**, and index rather than pointing: the rest of
 * this site is written in British English, and these are the words a UK
 * five-year-old is taught to name their own hand with.
 *
 * No thumb, deliberately. The thumb is the one entry in `Finger` that is not a
 * finger of one hand — it covers the space bar and both Alts, so there is no
 * "left" or "right" to say — and nothing that names a finger to a child ever
 * needs it: the shield has no thumb segment, because nothing falls on the
 * space bar (§8.5). Excluding it here means the eight zones and the eight
 * names are the same eight, checked by the compiler rather than by a reader.
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
 * The shift on the other hand from this finger.
 *
 * Typing `A` with the left pinky on shift and the left pinky on `a` is
 * impossible; the technique is right-shift plus left-`a`, and teaching it is
 * the single most-skipped thing in typing courses aimed at children. So the
 * hint highlights the shift a child can actually reach, which means knowing
 * which hand the letter is on.
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
 * That null is load-bearing rather than defensive: it is what `reachable()` is
 * built out of, and it is what would have caught the curly quotation marks
 * that `decks/typing.ts` had to hand-exclude from the Scripture pool — a verse
 * containing one is unpassable rather than hard, because typing marks exactly.
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
 * unlocking `a` does not hand a child `A`, and a generator that assumed it
 * would write a word nobody at that lesson can type.
 *
 * Both halves matter. The `keys` check is the curriculum's — don't use a key
 * they haven't met. The `strokeFor` check is the layout's — don't use a
 * character this board cannot produce at all, which is how prose pulled from
 * the passage library gets its curly quotes and dashes caught before a child
 * meets them.
 */
export function reachable(text: string, keys: ReadonlySet<string>): boolean {
  for (const ch of text) {
    if (!keys.has(ch)) return false;
    if (!strokeFor(ch)) return false;
  }
  return true;
}
