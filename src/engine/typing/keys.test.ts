import { describe, expect, it, vi } from "vitest";

import { canType, unlockedAt } from "./keys";
import { LESSONS } from "./lessons";
import type { Lesson } from "./lessons";
import { KEYS, strokeFor } from "../keyboard";

/**
 * The unlocked alphabet, asserted as a set of characters rather than a size
 * (§5.1, §5.2). A count is satisfied by thirty-one *wrong* characters, and the
 * failure this module exists to prevent is one specific key being in a set it
 * has no business being in. The hundredth lesson's expectation is computed
 * from the ladder, so re-ordering it re-derives the answer.
 */

/** A set of characters as one sorted string, so a diff prints readably. */
const chars = (set: ReadonlySet<string>) => [...set].sort().join("");

/** The same, for an expectation written in whatever order reads best. */
const sorted = (text: string) => [...text].sort().join("");

const byN = new Map(LESSONS.map((l) => [l.n, l]));
const introducedBy = (n: number) => byN.get(n)?.introduces ?? [];

/** Every character this board can produce, however far up the ladder. */
const EVERYTHING = new Set(
  KEYS.flatMap((k) => k.cap).filter((legend) => legend.length === 1),
);

/** Every character the ladder hands over, anywhere, plus the space bar. */
const EVER_INTRODUCED = new Set([" ", ...LESSONS.flatMap((l) => l.introduces)]);

/** `KeyboardEvent.code` → the character that key types unshifted. */
const BASE = new Map(
  KEYS.filter((k) => k.cap[0].length === 1).map((k) => [k.code, k.cap[0]]),
);

const CAPITALS = /^[A-Z]$/;
const capitalsIn = (set: ReadonlySet<string>) =>
  [...set].filter((ch) => CAPITALS.test(ch));

describe("unlockedAt", () => {
  /**
   * `;` is one of the eight home keys — the right pinky rests on it. Lessons
   * 7–10 introduce nothing, so the alphabet block 1 ends on is the one lesson
   * 6 left behind (§5.6).
   */
  it("is exactly the home row and the space bar at the end of block 1", () => {
    expect(chars(unlockedAt(10))).toBe(sorted("asdfghjkl; "));
    expect(chars(unlockedAt(6))).toBe(chars(unlockedAt(10)));
  });

  /**
   * The comma, the full stop and the slash are in a letters-only expectation
   * because they sit on the bottom row and arrive with it (§5.5). `;` and `/`
   * come back in block 7 as punctuation; a union does not double-count.
   */
  it("is every letter, and no capital, at the end of block 3", () => {
    expect(chars(unlockedAt(30))).toBe(
      sorted("abcdefghijklmnopqrstuvwxyz;,./ "),
    );
    expect(capitalsIn(unlockedAt(30))).toEqual([]);
  });

  /**
   * Nothing is silently dropped anywhere in the hundred: every shifted
   * character block 7 teaches has its base key and its shift behind it, or it
   * would be missing here.
   */
  it("covers everything the hundred lessons introduce", () => {
    expect(chars(unlockedAt(100))).toBe(chars(EVER_INTRODUCED));
    for (const ch of unlockedAt(100)) expect(strokeFor(ch), ch).not.toBeNull();
  });

  /**
   * The ten legends no lesson ever teaches: the backquote, both brackets, and
   * the four shifted characters — `^ < > |` — whose base keys the ladder does
   * teach. A closure over unlocked *keys* rather than a union of introduced
   * *characters* would hand all four over for free, `<` and `>` from lesson 31.
   */
  it("never hands over a character no lesson taught", () => {
    const untaught = [...EVERYTHING].filter((ch) => !unlockedAt(100).has(ch));
    expect(sorted(untaught.join(""))).toBe(sorted("`~[]{}|^<>"));
  });

  it("grows by exactly what each lesson introduces, and never shrinks", () => {
    for (let n = 1; n <= 100; n++) {
      const expected = new Set([...unlockedAt(n - 1), ...introducedBy(n)]);
      expect(chars(unlockedAt(n)), `lesson ${n}`).toBe(chars(expected));
    }
  });

  /**
   * Total, like `deckSpec(mode)`: a session saved against a ladder since
   * re-tuned still has to open its record book, and the number in its mode
   * string may not be on the ladder any more — or may not parse.
   */
  it("clamps a lesson number that is not on the ladder", () => {
    expect(chars(unlockedAt(0))).toBe(" ");
    expect(chars(unlockedAt(-3))).toBe(" ");
    expect(chars(unlockedAt(Number.NaN))).toBe(" ");
    expect(chars(unlockedAt(101))).toBe(chars(unlockedAt(100)));
    expect(chars(unlockedAt(1e6))).toBe(chars(unlockedAt(100)));
    expect(chars(unlockedAt(10.9))).toBe(chars(unlockedAt(10)));
    expect(chars(unlockedAt(Number.POSITIVE_INFINITY))).toBe(
      chars(unlockedAt(100)),
    );
    expect(chars(unlockedAt(Number.NEGATIVE_INFINITY))).toBe(" ");
  });
});

describe("the shift rule", () => {
  /**
   * Every letter is unlocked at lesson 26 and every capital needs one of them,
   * so a rule that only checked the letter would hand a child the whole of
   * block 4 four lessons early.
   */
  it("gives no capital before block 4, however old the letter is", () => {
    for (let n = 0; n <= 30; n++)
      expect(capitalsIn(unlockedAt(n)), `lesson ${n}`).toEqual([]);
    expect(unlockedAt(30).has("a")).toBe(true);
    expect(unlockedAt(30).has("A")).toBe(false);
  });

  /**
   * Lesson 31 is the right shift, which reaches the left hand's letters and
   * only those; `M` is a left-shift capital and waits for lesson 32.
   */
  it("arrives one shift at a time, in the hand each shift reaches", () => {
    expect(sorted(capitalsIn(unlockedAt(31)).join(""))).toBe(
      sorted("QWERTASDFGZXCVB"),
    );
    for (const ch of capitalsIn(unlockedAt(31)))
      expect(strokeFor(ch)?.shift, ch).toBe("ShiftRight");
    expect(sorted(capitalsIn(unlockedAt(32)).join(""))).toBe(
      sorted("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
    );
  });

  /**
   * Block 7's `!` and `?` are what this covers that block 4's capitals do not:
   * they arrive assuming the child already knows to hold shift, and this is
   * the assertion that they do.
   */
  it("needs both the base key and a shift, everywhere on the ladder", () => {
    for (let n = 0; n <= 100; n++) {
      const set = unlockedAt(n);
      const taught = new Set(
        capitalsIn(set).map((ch) => strokeFor(ch)?.shift ?? null),
      );
      for (const ch of set) {
        const stroke = strokeFor(ch);
        if (!stroke?.shift) continue;
        expect(taught.has(stroke.shift), `${ch} at lesson ${n}`).toBe(true);
        expect(set.has(BASE.get(stroke.code) ?? ""), `${ch} at ${n}`).toBe(
          true,
        );
      }
    }
  });
});

describe("canType", () => {
  it("passes text a child at that lesson has every key for", () => {
    expect(canType("a glass flask", 10)).toBe(true);
    expect(canType("a quick fox.", 24)).toBe(true);
    expect(canType("", 1)).toBe(true);
  });

  it("fails on a key the ladder has not reached yet", () => {
    // `w`, `e`, `m` and `t` are all block 2 or later.
    expect(canType("glad we met", 10)).toBe(false);
    // The full stop arrives with `x`, at lesson 24.
    expect(canType("a quick fox.", 23)).toBe(false);
    // Both digits are block 6, and they arrive in different lessons.
    expect(canType("45", 51)).toBe(true);
    expect(canType("42", 51)).toBe(false);
    expect(canType("42", 54)).toBe(true);
  });

  it("fails on a capital until the shift that reaches it is taught", () => {
    expect(canType("ask", 30)).toBe(true);
    expect(canType("Ask", 30)).toBe(false);
    expect(canType("Ask", 31)).toBe(true);
    // `M` is the right hand's, so it needs the left shift — lesson 32.
    expect(canType("Man", 31)).toBe(false);
    expect(canType("Man", 32)).toBe(true);
  });

  it("fails on a character the board cannot produce, at any lesson", () => {
    // The curly quotation marks `decks/typing.ts` had to hand-exclude from the
    // Scripture pool. No lesson unlocks them because no key produces them.
    expect(canType("“yes”", 100)).toBe(false);
    expect(canType("café", 100)).toBe(false);
  });

  /**
   * The generator's own reachability test (§5.2) is this assertion over the
   * words it produces; this is it over the keys the lesson declares.
   */
  it("can type the new keys of every lesson, at that lesson", () => {
    for (const lesson of LESSONS)
      expect(canType(lesson.introduces.join(""), lesson.n), lesson.id).toBe(
        true,
      );
  });
});

/**
 * The gate, on a ladder that gets it wrong.
 *
 * Today's hundred never introduce a shifted character before its base key or
 * before block 4 has taught a shift, so every assertion above still passes
 * with the rule deleted — the union alone satisfies them. These two are for
 * the ladder somebody re-orders, and a rule with no test is a rule the next
 * reader deletes as dead weight.
 */
describe("a ladder that introduces a key too early", () => {
  const lesson = (n: number, introduces: string): Lesson => ({
    n,
    id: `L${n}`,
    block: 1,
    title: `lesson ${n}`,
    introduces: [...introduces],
    kind: { type: "keys" },
    wordCount: 20,
    keyboard: "guide",
    pass: {
      kind: "lesson",
      accuracy: 0.95,
      wpm: 8,
      keyAccuracy: 0.9,
      keyStrikes: 12,
    },
  });

  /** `unlockedAt` built over a ladder of our own, not the hundred. */
  const ladderOf = async (lessons: Lesson[]) => {
    vi.resetModules();
    vi.doMock("./lessons", () => ({ LESSONS: lessons }));
    try {
      return (await import("./keys")).unlockedAt;
    } finally {
      vi.doUnmock("./lessons");
    }
  };

  it("withholds punctuation until a capital has taught its shift", async () => {
    // `?` is shift-`/`, and `/` is not a letter — so nothing on this ladder
    // has put a shift under anybody's pinky, and `?` cannot be struck.
    const unlockedAt = await ladderOf([lesson(1, "z/"), lesson(2, "?")]);
    expect(unlockedAt(2).has("/")).toBe(true);
    expect(unlockedAt(2).has("?")).toBe(false);
  });

  it("withholds a capital until its own letter arrives", async () => {
    const unlockedAt = await ladderOf([lesson(1, "A"), lesson(2, "a")]);
    expect(unlockedAt(1).has("A")).toBe(false);
    expect(unlockedAt(2).has("A")).toBe(true);
  });
});
