import { describe, expect, it } from "vitest";

import { HELD_KEY_LESSONS } from "./lessons";
import { freeHand, handOf, holdFor, oneHanded } from "./hands";

/**
 * What one hand can type with the other held down (§5.8).
 *
 * The rule is small and every part of a held-key lesson leans on it: the
 * generator filters every pool through it, the table's tests check every key
 * drilled against it, and the run trusts the text because of it.
 */

describe("handOf", () => {
  it("puts eight fingers on two hands and the thumb on neither", () => {
    expect(handOf("l-index")).toBe("left");
    expect(handOf("l-pinky")).toBe("left");
    expect(handOf("r-index")).toBe("right");
    expect(handOf("r-ring")).toBe("right");
    expect(handOf("thumb")).toBeNull();
  });
});

describe("freeHand", () => {
  it("is the hand not holding the key", () => {
    expect(freeHand("f")).toBe("right");
    expect(freeHand("j")).toBe("left");
  });

  it("frees nothing for a thumb key or a character the board lacks", () => {
    expect(freeHand(" ")).toBeNull();
    expect(freeHand("é")).toBeNull();
  });
});

describe("oneHanded", () => {
  it("passes text the free hand can type on its own", () => {
    expect(oneHanded("you", "f")).toBe(true);
    expect(oneHanded("hjkl;", "f")).toBe(true);
    expect(oneHanded("was", "j")).toBe(true);
    expect(oneHanded("12345", "j")).toBe(true);
  });

  it("fails a character on the pinned hand, the held key included", () => {
    expect(oneHanded("f", "f")).toBe(false);
    expect(oneHanded("yes", "f")).toBe(false);
    expect(oneHanded("jam", "j")).toBe(false);
  });

  /** The shift for a right-hand letter is the left pinky's, which is holding. */
  it("fails every shifted character, because the shift is the other hand's", () => {
    expect(oneHanded("You", "f")).toBe(false);
    expect(oneHanded("?", "f")).toBe(false);
    expect(oneHanded("Was", "j")).toBe(false);
  });

  it("lets the space bar through — the thumb is either hand's", () => {
    expect(oneHanded("you up", "f")).toBe(true);
    expect(oneHanded(" ", "f")).toBe(true);
  });

  it("fails a character this board cannot produce", () => {
    expect(oneHanded("’", "f")).toBe(false);
  });

  it("fails everything when the held key frees no hand", () => {
    expect(oneHanded("you", " ")).toBe(false);
  });
});

describe("holdFor", () => {
  it("resolves every shipped held key to a code, a finger and a free hand", () => {
    for (const lesson of HELD_KEY_LESSONS) {
      const hold = holdFor(lesson);
      expect(hold, lesson.id).not.toBeNull();
      expect(hold?.key).toBe(lesson.hold);
      expect(hold?.code).toBe(lesson.hold === "f" ? "KeyF" : "KeyJ");
      expect(hold?.finger).toBe(
        lesson.hold === "f" ? "left index finger" : "right index finger",
      );
      expect(hold?.free).toBe(lesson.hold === "f" ? "right" : "left");
    }
  });

  it("hands back null for a key this board cannot place", () => {
    const lesson = { ...HELD_KEY_LESSONS[0], hold: "é" };
    expect(holdFor(lesson)).toBeNull();
  });
});
