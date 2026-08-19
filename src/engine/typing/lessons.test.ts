import { describe, expect, it } from "vitest";

import { LESSONS, lessonById } from "./lessons";
import type { Lesson } from "./lessons";
import { strokeFor } from "../keyboard";

/**
 * The cheap tests that catch the embarrassing failures (docs/typing.md §12).
 *
 * The expensive ones — reachability, and "the new key shows up often enough" —
 * belong to the generator and cannot be written until it exists. What can be
 * written now is everything the table itself claims: that it is a hundred
 * lessons, numbered once each, with the checkpoints where the blocks say they
 * are and the keyboard off when it has to be.
 */

const byN = new Map(LESSONS.map((l) => [l.n, l]));
const lesson = (n: number): Lesson => {
  const found = byN.get(n);
  if (!found) throw new Error(`no lesson ${n}`);
  return found;
};

const BLOCKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const inBlock = (block: number) => LESSONS.filter((l) => l.block === block);
const introducesNothing = (block: number) =>
  inBlock(block).every((l) => l.introduces.length === 0);

/** The wpm a lesson asks for. Storm levels ask to be survived instead. */
const wpmOf = (l: Lesson) => (l.pass.kind === "lesson" ? l.pass.wpm : null);

describe("the shape of the ladder", () => {
  it("is a hundred lessons", () => {
    expect(LESSONS).toHaveLength(100);
  });

  it("numbers them 1–100 with no gaps", () => {
    expect(LESSONS.map((l) => l.n)).toEqual(
      Array.from({ length: 100 }, (_, i) => i + 1),
    );
  });

  it("gives every lesson its own id, and never reuses one", () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(100);
  });

  /**
   * The id is what goes into `Session.mode` as `typing:L07`, so it outlives
   * every re-tuning of the lesson it names. Pinning the format here is pinning
   * a promise to runs already saved: change it and a record book two years old
   * stops being able to say what it is looking at.
   */
  it("writes the id as L + the number, two digits", () => {
    expect(lesson(1).id).toBe("L01");
    expect(lesson(7).id).toBe("L07");
    expect(lesson(50).id).toBe("L50");
    expect(lesson(100).id).toBe("L100");
  });

  /**
   * The other half of that promise: the id has to resolve back. A screen asks
   * "is this run a lesson?" with a config in hand and gets the lesson or
   * nothing — never a throw, because a saved run outlives the ladder it was
   * played on and every one of these three cases reaches a live screen.
   */
  it("resolves an id back to its lesson, and anything else to null", () => {
    expect(lessonById("L07")).toBe(lesson(7));
    expect(lessonById("L100")).toBe(lesson(100));
    // A free-play config, which simply has no lesson id.
    expect(lessonById(undefined)).toBeNull();
    // A level id, which shares the `typing:` prefix and is not on the ladder.
    expect(lessonById("home-row")).toBeNull();
    // A lesson a later build re-cut away from under a run already saved.
    expect(lessonById("L101")).toBeNull();
  });

  it("puts ten lessons in each of ten blocks", () => {
    for (const block of BLOCKS) expect(inBlock(block)).toHaveLength(10);
  });

  it("counts twenty storm levels and thirty lessons that introduce keys", () => {
    const storms = LESSONS.filter((l) => l.kind.type === "storm");
    const introducing = LESSONS.filter((l) => l.introduces.length > 0);
    expect(storms).toHaveLength(20);
    expect(introducing).toHaveLength(30);
    // §5.6's closing line says thirty-five. Its own tables say thirty, and the
    // tables are the hundred rows — five of block 4's ten are capitals, an
    // apostrophe and a storm rather than five key lessons, and blocks 5, 8, 9
    // and 10 introduce nothing at all. The rows are what was transcribed.
  });
});

describe("checkpoints", () => {
  it("puts one at the end of every block, and nowhere else", () => {
    for (const l of LESSONS) expect(l.checkpoint ?? false).toBe(l.n % 10 === 0);
    expect(LESSONS.filter((l) => l.checkpoint)).toHaveLength(10);
  });

  /**
   * A checkpoint that can be passed while reading the answer off the screen
   * measures nothing (§4.2), and a checkpoint is the placement test — passing
   * number 40 clears 1–39 with it (§6.6). So the board is off and the player's
   * own toggle cannot turn it back on.
   */
  it("hides the keyboard, and does not let the player show it", () => {
    for (const l of LESSONS.filter((l) => l.checkpoint)) {
      expect(l.keyboard).toBe("off");
      expect(l.keyboardLocked).toBe(true);
    }
  });

  it("introduces nothing — it is a test of what is already there", () => {
    for (const l of LESSONS.filter((l) => l.checkpoint))
      expect(l.introduces).toEqual([]);
  });

  it("is never a storm level, because a storm never gates the ladder", () => {
    for (const l of LESSONS.filter((l) => l.checkpoint))
      expect(l.kind.type).not.toBe("storm");
  });
});

describe("the keyboard on screen", () => {
  /**
   * Lesson 1 is the other end of the lock: a child who has never seen a
   * keyboard cannot be asked to guess where `f` is.
   */
  it("locks the first lesson to the guide", () => {
    expect(lesson(1).keyboard).toBe("guide");
    expect(lesson(1).keyboardLocked).toBe(true);
  });

  it("only ever locks a lesson to `guide` or to `off`", () => {
    for (const l of LESSONS.filter((l) => l.keyboardLocked))
      expect(["guide", "off"]).toContain(l.keyboard);
  });

  it("shows the guide on every lesson that introduces keys", () => {
    for (const l of LESSONS.filter((l) => l.introduces.length > 0)) {
      expect(l.keyboard).toBe("guide");
      expect(l.keyboardLocked).toBe(true);
    }
  });
});

describe("the keys, and the order they arrive in", () => {
  it("introduces only characters this board can produce", () => {
    for (const l of LESSONS)
      for (const ch of l.introduces) expect(strokeFor(ch)).not.toBeNull();
  });

  it("introduces a character at most once per lesson", () => {
    for (const l of LESSONS)
      expect(new Set(l.introduces).size).toBe(l.introduces.length);
  });

  it("has the whole alphabet unlocked by the end of block 3", () => {
    const unlocked = new Set(
      LESSONS.filter((l) => l.n <= 30).flatMap((l) => l.introduces),
    );
    for (const ch of "abcdefghijklmnopqrstuvwxyz")
      expect(unlocked.has(ch)).toBe(true);
  });

  /**
   * Mirrored pairs, one per hand, through the three letter blocks (§5.5).
   *
   * `f`/`j` are the index home keys and `d`/`k`, `s`/`l`, `a`/`;` walk outward
   * together — the same finger on each hand, every time. It keeps the hands
   * balanced and it teaches the symmetry, which is what makes the bottom row
   * guessable by the time a child reaches it.
   */
  it("hands the letters over one finger at a time, both hands at once", () => {
    const letterBlocks = LESSONS.filter(
      (l) => l.block <= 3 && l.introduces.length > 0,
    );
    expect(letterBlocks).toHaveLength(15);

    for (const l of letterBlocks) {
      const fingers = l.introduces.map((ch) => strokeFor(ch)?.finger);
      expect(fingers).toHaveLength(2);
      const [left, right] = fingers;
      expect(left?.startsWith("l-"), `${l.id} ${l.title}`).toBe(true);
      expect(right?.startsWith("r-"), `${l.id} ${l.title}`).toBe(true);
      expect(left?.slice(2)).toBe(right?.slice(2));
    }
  });

  /**
   * The number row is the deliberate exception, and this is the rule it
   * follows instead: each pair straddles the centre of the board, so the two
   * digits always sum to nine. `4 5` are both the left index's and `9 0` are
   * the right ring and pinky — the standard assignment, not a slip, which is
   * why the mirrored-hand test above stops at block 3.
   */
  it("walks the number row outward from the middle of the board", () => {
    const digits = LESSONS.filter((l) => l.block === 6 && l.introduces.length);
    expect(digits).toHaveLength(5);
    for (const l of digits) {
      expect(l.introduces).toHaveLength(2);
      const [a, b] = l.introduces.map(Number);
      expect(a + b).toBe(9);
    }
  });
});

describe("the pass criteria", () => {
  it("gives a storm level a survive bar and everything else three", () => {
    for (const l of LESSONS)
      expect(l.pass.kind).toBe(l.kind.type === "storm" ? "storm" : "lesson");
  });

  it("asks 95% of a lesson and more of a checkpoint", () => {
    for (const l of LESSONS) {
      if (l.pass.kind !== "lesson") continue;
      expect(l.pass.accuracy).toBeGreaterThanOrEqual(0.95);
      expect(l.pass.accuracy).toBeLessThanOrEqual(0.99);
      if (l.checkpoint) expect(l.pass.accuracy).toBeGreaterThan(0.95);
    }
  });

  /**
   * The gate that turns a hundred typing tests into a hundred lessons (§6.4):
   * `z` is 3% of the text, so 95% and 12 wpm can both be met while getting it
   * wrong every single time it appears. It only has to be askable — a lesson
   * that wanted twelve strikes of each of fifteen new capitals would want a
   * hundred and eighty of them in a hundred and fifty characters.
   */
  it("asks for enough of each new key to judge it, and no more than fits", () => {
    for (const l of LESSONS) {
      if (l.pass.kind !== "lesson" || l.introduces.length === 0) continue;
      expect(l.pass.keyAccuracy).toBe(0.9);
      expect(l.pass.keyStrikes).toBeGreaterThanOrEqual(2);
      expect(l.pass.keyStrikes).toBeLessThanOrEqual(12);
      const demanded = l.pass.keyStrikes * l.introduces.length;
      expect(demanded).toBeLessThanOrEqual(l.wordCount * 5 * 0.35);
    }
  });

  it("asks twelve strikes wherever a lesson arrives two keys at a time", () => {
    for (const l of LESSONS) {
      if (l.pass.kind !== "lesson" || l.introduces.length !== 2) continue;
      expect(l.pass.keyStrikes, l.id).toBe(12);
    }
  });
});

describe("the speed bar", () => {
  /**
   * Read the wpm column down the page and it does NOT climb smoothly — it
   * drops every time a key arrives and climbs back over the review lessons
   * after it. Lesson 50 asks 25 and lesson 51 asks 16 (§6.3, decision 11).
   *
   * So the non-decreasing claim is about BLOCKS, and only the blocks that
   * introduce nothing: 5, 8, 9 and 10 are forty lessons of pure practice, and
   * speed is the only thing left for them to be about. Reading it per lesson
   * would be false even inside those blocks — 44 is harder material than 43
   * and 97 is the accuracy run — and a test that asserted it would be a test
   * that has to be deleted the first time someone reads the doc.
   */
  const checkpointWpm = (block: number) => wpmOf(lesson(block * 10)) ?? 0;

  it("never lowers the bar in a block that introduces nothing", () => {
    const quiet = BLOCKS.filter(introducesNothing);
    expect(quiet).toEqual([5, 8, 9, 10]);
    for (const block of quiet)
      expect(checkpointWpm(block), `block ${block}`).toBeGreaterThanOrEqual(
        checkpointWpm(block - 1),
      );
  });

  it("climbs fastest across those blocks", () => {
    expect(BLOCKS.filter(introducesNothing).map(checkpointWpm)).toEqual([
      25, 28, 35, 38,
    ]);
  });

  it("makes each block's checkpoint its own highest bar", () => {
    for (const block of BLOCKS) {
      const asked = inBlock(block)
        .filter((l) => !l.checkpoint)
        .map(wpmOf)
        .filter((wpm) => wpm !== null);
      expect(Math.max(...asked), `block ${block}`).toBeLessThan(
        checkpointWpm(block),
      );
    }
  });

  /**
   * The dip, pinned so nobody smooths it out. A lesson that introduces keys
   * targets about 80% of its block's running figure: you have just got slower
   * and you should have, and a ladder that pretended otherwise would punish
   * the exact moment it should encourage.
   */
  it("drops below the block's own figure whenever keys arrive", () => {
    for (const l of LESSONS.filter((l) => l.introduces.length > 0)) {
      const asked = wpmOf(l) ?? 0;
      expect(asked, l.id).toBeLessThan(checkpointWpm(l.block));
    }
    expect(wpmOf(lesson(50))).toBe(25);
    expect(wpmOf(lesson(51))).toBe(16);
  });
});
