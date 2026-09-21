import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { oneHanded } from "./hands";
import { unlockedAt } from "./keys";
import {
  HELD_KEY_LESSONS,
  LESSONS,
  isHeldKeyLesson,
  lessonById,
  lessonNumbered,
} from "./lessons";
import type { Lesson } from "./lessons";
import { strokeFor } from "../keyboard";

/**
 * What the table itself claims (§12). Reachability and "the new key shows up
 * often enough" belong to the generator, and live in `generate.test.ts`.
 */

const byN = new Map(LESSONS.map((l) => [l.n, l]));
const lesson = (n: number): Lesson => {
  const found = byN.get(n);
  if (!found) throw new Error(`no lesson ${n}`);
  return found;
};

const BLOCKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const inBlock = (block: number) => LESSONS.filter((l) => l.block === block);
const lastOf = (block: number): Lesson => {
  const last = inBlock(block).at(-1);
  if (!last) throw new Error(`block ${block} is empty`);
  return last;
};
const introducesNothing = (block: number) =>
  inBlock(block).every((l) => l.introduces.length === 0);

/** The wpm a lesson asks for. Storm levels ask to be survived instead. */
const wpmOf = (l: Lesson) => (l.pass.kind === "lesson" ? l.pass.wpm : null);

describe("the shape of the ladder", () => {
  it("is a hundred and ten lessons", () => {
    expect(LESSONS).toHaveLength(110);
  });

  it("numbers them 1–110 with no gaps", () => {
    expect(LESSONS.map((l) => l.n)).toEqual(
      Array.from({ length: 110 }, (_, i) => i + 1),
    );
  });

  it("gives every lesson its own id, and never reuses one", () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(110);
  });

  /**
   * The id is what goes into `Session.mode` as `typing:L07`, so pinning it is
   * pinning a promise to runs already saved: change it and a record book two
   * years old stops being able to say what it is looking at. The hundred kept
   * the names they had when they were the whole ladder, so the number in an
   * id is not the rung — `L07` is lesson 9 (§5.8).
   */
  it("keeps the hundred's ids where their runs were filed, whatever the rung", () => {
    expect(lesson(1).id).toBe("L01");
    expect(lesson(6).id).toBe("L06");
    expect(lesson(9).id).toBe("L07");
    expect(lesson(58).id).toBe("L50");
    expect(lesson(110).id).toBe("L100");
  });

  /**
   * The id has to resolve back, and never throw: a saved run outlives the
   * ladder it was played on, and every one of these three cases reaches a live
   * screen.
   */
  it("resolves an id back to its lesson, and anything else to null", () => {
    expect(lessonById("L07")).toBe(lesson(9));
    expect(lessonById("L100")).toBe(lesson(110));
    expect(lessonById("H01")).toBe(lesson(7));
    // A free-play config, which simply has no lesson id.
    expect(lessonById(undefined)).toBeNull();
    // A level id, which shares the `typing:` prefix and is not on the ladder.
    expect(lessonById("home-row")).toBeNull();
    // A lesson a later build re-cut away from under a run already saved.
    expect(lessonById("L101")).toBeNull();
  });

  /** Ten blocks cut at the checkpoints; twelve long where a pair is woven in. */
  it("cuts the ladder into ten blocks at the checkpoints", () => {
    expect(BLOCKS.map((block) => inBlock(block).length)).toEqual([
      12, 12, 12, 10, 12, 12, 10, 10, 10, 10,
    ]);
    for (const block of BLOCKS)
      for (const l of inBlock(block)) expect(l.block).toBe(block);
  });

  it("counts twenty storms, ten held-key lessons and thirty that introduce keys", () => {
    const storms = LESSONS.filter((l) => l.kind.type === "storm");
    const introducing = LESSONS.filter(
      (l) => l.introduces.length > 0 && !isHeldKeyLesson(l),
    );
    expect(storms).toHaveLength(20);
    expect(HELD_KEY_LESSONS).toHaveLength(10);
    expect(introducing).toHaveLength(30);
  });

  /**
   * §5.6 is checked, not trusted, the way `storms.test.ts` checks §5.7: a
   * hundred and ten rows in prose beside a hundred and ten in code, compared
   * cell by cell. The id column is the half that matters most — an id
   * mistyped in either place orphans every run already saved under it
   * (§5.4), and nothing on screen would show it.
   */
  it("matches §5.6's tables in docs/typing.md, column by column", () => {
    const doc = readFileSync("docs/typing.md", "utf8");
    const section = doc.split("### 5.6 · ")[1].split(/\n#{2,3} /)[0];
    const rows = [
      ...section.matchAll(/^\|\s*(\d+)\s*\|\s*([A-Z]\d+)\s*\|(.+)\|\s*$/gm),
    ].map((match) => [
      match[1],
      match[2],
      ...match[3].split("|").map((cell) => cell.trim()),
    ]);
    expect(rows).toHaveLength(LESSONS.length);

    const plain = (cell: string | undefined) =>
      (cell ?? "").replace(/\*\*/g, "");
    const printed = (cells: string[]) => {
      const [n, id, title, keys, kind, board, words, wpm, acc] = cells.map(
        (cell) => plain(cell),
      );
      return {
        n: Number(n),
        id,
        title,
        // Block 4's two rows print the shift and the hand it reaches rather
        // than fifteen capitals apiece; §5.5 says why.
        introduces:
          keys === "—"
            ? ""
            : keys.startsWith("`⇧`")
              ? "⇧"
              : keys.replace(/[` ]/g, ""),
        kind,
        keyboard: board.replace("🔒", ""),
        locked: board.endsWith("🔒"),
        wordCount: Number(words),
        wpm: wpm === "—" ? null : Number(wpm),
        accuracy: acc === "—" ? null : Number(acc.replace("%", "")) / 100,
      };
    };
    const shipped = (l: Lesson) => ({
      n: l.n,
      id: l.id,
      title: l.title,
      introduces:
        l.introduces.length > 2 && l.introduces.every((ch) => /[A-Z]/.test(ch))
          ? "⇧"
          : l.introduces.join(""),
      kind: l.kind.type,
      keyboard: l.keyboard,
      locked: l.keyboardLocked === true,
      wordCount: l.wordCount,
      wpm: wpmOf(l),
      accuracy: l.pass.kind === "lesson" ? l.pass.accuracy : null,
    });

    expect(rows.map(printed)).toEqual(LESSONS.map(shipped));
  });
});

describe("checkpoints", () => {
  it("puts one at the end of every block, and nowhere else", () => {
    for (const block of BLOCKS)
      for (const l of inBlock(block))
        expect(l.checkpoint ?? false, l.id).toBe(l === lastOf(block));
    expect(LESSONS.filter((l) => l.checkpoint)).toHaveLength(10);
  });

  /**
   * A checkpoint is the placement test, so it cannot be passed with the answer
   * on screen (§4.2, §6.6) — hence the board off *and* the player's toggle
   * locked.
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
    // A held-key lesson is the one exception, and it locks the other way: the
    // board is where the held key is drawn, so it may insist on `keys` (§5.8).
    for (const l of LESSONS.filter((l) => l.keyboardLocked))
      expect(
        isHeldKeyLesson(l) ? ["guide", "keys"] : ["guide", "off"],
      ).toContain(l.keyboard);
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
      LESSONS.filter((l) => l.block <= 3).flatMap((l) => l.introduces),
    );
    for (const ch of "abcdefghijklmnopqrstuvwxyz")
      expect(unlocked.has(ch)).toBe(true);
  });

  /**
   * Mirrored pairs, one per hand, through the three letter blocks (§5.5):
   * `f`/`j`, then `d`/`k`, `s`/`l`, `a`/`;` walking outward — the same finger
   * on each hand, every time. The held-key pairs hand a row over again, five
   * to a hand (§5.8), and are held to their own rule below.
   */
  it("hands the letters over one finger at a time, both hands at once", () => {
    const letterBlocks = LESSONS.filter(
      (l) => l.block <= 3 && l.introduces.length > 0 && !isHeldKeyLesson(l),
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
   * The number row is the exception to the pair above, which is why that one
   * stops at block 3: each pair straddles the center of the board and so sums
   * to nine. `4 5` are both the left index's, `9 0` the right ring and pinky —
   * the standard assignment, not a slip.
   */
  it("walks the number row outward from the middle of the board", () => {
    const digits = LESSONS.filter(
      (l) => l.block === 6 && l.introduces.length && !isHeldKeyLesson(l),
    );
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
   * §6.4's gate, and the ceiling on it: twelve strikes of each of fifteen new
   * capitals would want a hundred and eighty of them in a hundred and fifty
   * characters, which is what the last assertion sizes.
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
   * The wpm column does not climb smoothly — it drops every time a key arrives
   * and climbs back over the review lessons after it (§6.3, decision 11). So
   * the non-decreasing claim is about BLOCKS, and only the four that introduce
   * nothing; per lesson it would be false even inside those, since 50 is
   * harder material than 49 and 107 is the accuracy run.
   */
  const checkpointWpm = (block: number) => wpmOf(lastOf(block)) ?? 0;

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
   * The dip, pinned so nobody smooths it out: a lesson that introduces keys
   * targets about 80% of its block's running figure.
   */
  it("drops below the block's own figure whenever keys arrive", () => {
    for (const l of LESSONS.filter((l) => l.introduces.length > 0)) {
      const asked = wpmOf(l) ?? 0;
      expect(asked, l.id).toBeLessThan(checkpointWpm(l.block));
    }
    expect(wpmOf(lesson(58))).toBe(25);
    expect(wpmOf(lesson(59))).toBe(16);
  });
});

describe("the held-key lessons", () => {
  /** The five pairs, in ladder order: right hand, then left, side by side. */
  const PAIRS = HELD_KEY_LESSONS.filter((_, i) => i % 2 === 0).map(
    (right) => [right, lesson(right.n + 1)] as const,
  );

  it("is ten, on the ladder, with ids of its own", () => {
    expect(HELD_KEY_LESSONS).toHaveLength(10);
    for (const l of HELD_KEY_LESSONS) {
      expect(l.id).toMatch(/^H\d\d$/);
      expect(LESSONS).toContain(l);
      expect(lessonNumbered(l.n)).toBe(l);
      expect(lessonById(l.id)).toBe(l);
    }
    expect(isHeldKeyLesson(lessonById("L01"))).toBe(false);
    expect(isHeldKeyLesson(null)).toBe(false);
  });

  /**
   * Where §5.8 puts them: five pairs, each straight after the lesson that
   * finishes the row of keys it drills — and never after a storm or the other
   * pair, so the rung that opens a pair is an ordinary lesson.
   */
  it("sits in five pairs after the lesson that finishes a row", () => {
    expect(HELD_KEY_LESSONS.map((l) => l.n)).toEqual([
      7, 8, 20, 21, 31, 32, 54, 55, 65, 66,
    ]);
    for (const [right, left] of PAIRS) {
      expect(isHeldKeyLesson(left)).toBe(true);
      const before = lesson(right.n - 1);
      expect(before.kind.type, right.id).not.toBe("storm");
      expect(isHeldKeyLesson(before), right.id).toBe(false);
    }
  });

  /** Decision 75: the two keys with a bump, and the index finger's home. */
  it("holds f for the right hand and j for the left, right hand first", () => {
    for (const [right, left] of PAIRS) {
      expect(right.hold).toBe("f");
      expect(left.hold).toBe("j");
    }
  });

  /** The hand in the title is the hand that types, and it says which key. */
  it("titles every lesson by the hand that types, then what the pair is about", () => {
    for (const [right, left] of PAIRS) {
      expect(right.title.startsWith("Right hand · "), right.id).toBe(true);
      expect(left.title.startsWith("Left hand · "), left.id).toBe(true);
      expect(right.title.split(" · ")[1]).toBe(left.title.split(" · ")[1]);
    }
  });

  /**
   * §5.8's own invariant, on the keys the gate is about: each is on the free
   * hand, and the ladder taught it before the pair arrived. A key on the
   * pinned hand could never be struck, and the gate would then never open.
   */
  it("drills only keys the free hand has, and the ladder had taught", () => {
    for (const [right] of PAIRS)
      for (const l of [right, lesson(right.n + 1)])
        for (const ch of l.introduces) {
          expect(oneHanded(ch, l.hold ?? ""), `${l.id} ${ch}`).toBe(true);
          expect(unlockedAt(right.n - 1).has(ch), `${l.id} ${ch}`).toBe(true);
        }
  });

  it("drills keys as a drill and words as words", () => {
    for (const l of HELD_KEY_LESSONS) {
      if (l.kind.type === "keys")
        expect(l.introduces.length).toBeGreaterThan(0);
      else expect(l.introduces).toEqual([]);
    }
  });

  /** The board is where the held key is drawn, so it cannot be turned off. */
  it("keeps the board on, and does not let the player hide it", () => {
    for (const l of HELD_KEY_LESSONS) {
      expect(l.keyboard, l.id).not.toBe("off");
      expect(l.keyboardLocked, l.id).toBe(true);
    }
  });

  it("marks three bars, with the gate sized to fit", () => {
    for (const l of HELD_KEY_LESSONS) {
      expect(l.pass.kind).toBe("lesson");
      if (l.pass.kind !== "lesson") continue;
      expect(l.pass.accuracy).toBe(0.95);
      if (l.introduces.length === 0) continue;
      expect(l.pass.keyStrikes).toBeGreaterThanOrEqual(2);
      const demanded = l.pass.keyStrikes * l.introduces.length;
      expect(demanded).toBeLessThanOrEqual(l.wordCount * 5 * 0.35);
    }
  });

  /** One hand doing the work of two is slower, and the bar says so. */
  it("asks for less speed than the lesson the pair follows", () => {
    for (const [right, left] of PAIRS) {
      const before = lesson(right.n - 1).pass;
      expect(before.kind).toBe("lesson");
      if (before.kind !== "lesson") continue;
      for (const l of [right, left])
        expect(wpmOf(l) ?? 0, l.id).toBeLessThan(before.wpm);
    }
  });

  it("is never a checkpoint and never holds a wave", () => {
    for (const l of HELD_KEY_LESSONS) {
      expect(l.checkpoint).toBeUndefined();
      expect(l.kind.type).not.toBe("storm");
    }
  });
});
