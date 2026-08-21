import { KEYS, reachable, strokeFor } from "@/engine/keyboard";
import type { Stroke } from "@/engine/keyboard";
import { LESSONS } from "./lessons";

/**
 * What a child may be asked to type at lesson n (docs/typing.md §5.1, §5.2).
 *
 * The **unlocked alphabet** at lesson n is the union of `introduces` over
 * lessons 1…n, plus space, and it is *computed here, never written down*: a
 * per-block alphabet spelled out in a table is a second source of truth that a
 * re-ordered ladder walks away from silently, and what that produces is a
 * lesson asking a five-year-old for a key nobody has shown them. Move a lesson
 * and its alphabet moves with it, because there is nowhere else for it to be.
 * It is what the reachability invariant is checked against (§5.2), and why the
 * layout is in the engine rather than the view (§3.1).
 *
 * A shifted character needs both of its keys: `strokeFor("A")` names KeyA
 * *and* ShiftRight (§3.3), so `A` is locked until both have been taught. That
 * is why the capitals are still out of reach at lesson 30, where every letter
 * has arrived and neither shift has — a naive union would hand them over and
 * leave block 4 with nothing to teach.
 */

/** The one character no lesson introduces, because words are made of them. */
const SPACE = " ";

type ShiftCode = NonNullable<Stroke["shift"]>;

/**
 * `KeyboardEvent.code` → the character that key types on its own.
 *
 * The inverse of half of `strokeFor`, and the only way back from a stroke to
 * the base character a shifted one is built on: `A` names KeyA, and KeyA's
 * unshifted legend is `a`. Word legends ("Tab", "Shift") are left out, so a
 * modifier has no base character and can never satisfy the check below.
 */
const UNSHIFTED = new Map(
  KEYS.filter((k) => k.cap[0].length === 1).map((k) => [k.code, k.cap[0]]),
);

/** Single lowercase letters, which is what makes a shifted character a capital. */
const LETTER = /^[a-z]$/;

/**
 * The shift a character teaches, or null if it teaches none.
 *
 * A shift is not a character, so it can never appear in `introduces` — and yet
 * it plainly has to be unlocked by something, or `A` is either free from
 * lesson 1 or unreachable forever. Block 4 unlocks it by introducing the
 * capitals each shift reaches (§5.5), so each of its two lessons teaches only
 * the shift it is actually held with: ShiftLeft is still locked when lesson
 * 31's fifteen right-shift capitals end.
 *
 * Every *other* shifted character on the board — `!`, `?`, `:`, `"` — arrives
 * in block 7 assuming the child already knows to hold shift. So a capital
 * teaches a shift and punctuation does not, which is what gives the rule below
 * its teeth: a punctuation lesson dragged up in front of block 4 loses its
 * keys instead of quietly teaching a technique nobody has been shown.
 */
function shiftTaughtBy(ch: string): ShiftCode | null {
  const stroke = strokeFor(ch);
  if (!stroke?.shift) return null;
  const base = UNSHIFTED.get(stroke.code);
  return base && LETTER.test(base) ? stroke.shift : null;
}

/**
 * The introduced characters that can actually be struck, given the shifts.
 *
 * Three ways a character fails to make it out of the union:
 *
 *   - **The board cannot produce it.** `strokeFor` is null — a curly quote
 *     that reached `introduces` by way of a copy-paste. `reachable` checks
 *     this too, but the alphabet is handed to other callers (the generator's
 *     pools, Hailstorm's waves) and it should not carry a character no
 *     keyboard can type.
 *   - **No shift has been taught yet.** The capitals at lesson 30.
 *   - **Its base key has not arrived.** `_` before `-`, `?` before `/`.
 *
 * Today's ladder never hits the last two — the test at lesson 100 asserts the
 * whole union survives — and dropping is the safe direction anyway: a lesson
 * that loses its own new keys fails §5.2's reachability test loudly, where
 * handing a child an untaught key fails silently, in front of them.
 */
function strikeable(
  unlocked: ReadonlySet<string>,
  shifts: ReadonlySet<ShiftCode>,
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const ch of unlocked) {
    const stroke = strokeFor(ch);
    if (!stroke) continue;
    if (!stroke.shift) {
      out.add(ch);
      continue;
    }
    if (!shifts.has(stroke.shift)) continue;
    const base = UNSHIFTED.get(stroke.code);
    if (base !== undefined && unlocked.has(base)) out.add(ch);
  }
  return out;
}

/**
 * Every alphabet on the ladder, indexed by lesson number.
 *
 * Built once, walking the lessons in order of `n` rather than array order —
 * `n` is the number in `Session.mode` and the array is a table someone will
 * one day re-order in place, so "lessons 1…n" means what it says. Index 0 is
 * the alphabet before the ladder starts: the space bar and nothing else.
 *
 * A hundred sets of a hundred characters is a few thousand strings held for
 * the life of the process, and the alternative is rebuilding the union on
 * every call from a generator that asks per lesson, per seed, per word.
 */
const ALPHABETS: readonly ReadonlySet<string>[] = (() => {
  const unlocked = new Set([SPACE]);
  const shifts = new Set<ShiftCode>();
  const alphabets: ReadonlySet<string>[] = [strikeable(unlocked, shifts)];

  for (const lesson of [...LESSONS].sort((a, b) => a.n - b.n)) {
    for (const ch of lesson.introduces) {
      unlocked.add(ch);
      const shift = shiftTaughtBy(ch);
      if (shift) shifts.add(shift);
    }
    // A gap in the numbering carries the previous alphabet forward rather than
    // leaving a hole `unlockedAt` would return `undefined` from. The ladder is
    // 1–100 with no gaps and lessons.test.ts pins that; this is what keeps the
    // signature honest anyway.
    while (alphabets.length < lesson.n)
      alphabets.push(alphabets[alphabets.length - 1]);
    alphabets[lesson.n] = strikeable(unlocked, shifts);
  }

  return alphabets;
})();

/**
 * The characters a child has met by the end of lesson `n`, plus space.
 *
 * Total, and never throws: a number off the end of the ladder is the whole
 * alphabet and one before the start is the space bar, for the same reason
 * `deckSpec(mode)` never throws — a saved session outlives the ladder it was
 * run on. `NaN` is the one input sent to the start rather than the end,
 * because it is not a lesson number that overshot but a `Number("L7x")` that
 * failed, and the safe answer to a question nobody asked is the space bar
 * rather than an alphabet somebody was never given.
 *
 * The set is shared, not copied. `ReadonlySet` because every caller reads it;
 * one that mutated it would be editing the curriculum for everybody else in
 * the tab.
 */
export function unlockedAt(n: number): ReadonlySet<string> {
  const last = ALPHABETS.length - 1;
  const i = Number.isNaN(n) ? 0 : Math.min(Math.max(Math.floor(n), 0), last);
  return ALPHABETS[i];
}

/**
 * Can every character of `text` be typed by a child at lesson `n`?
 *
 * The composition the generator is checked against (§5.2), and the two halves
 * are different questions: `unlockedAt` is the curriculum's — don't use a key
 * they haven't met — and `strokeFor`, inside `reachable`, is the layout's —
 * don't use a character this board cannot produce at all. That second half is
 * what catches prose pulled from the passage library before a child meets a
 * curly quote they can never satisfy.
 */
export function canType(text: string, n: number): boolean {
  return reachable(text, unlockedAt(n));
}
