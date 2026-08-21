import { describe, expect, it } from "vitest";

import { LESSONS, lessonById } from "@/engine/typing/lessons";

import { keyboardFor, keyboardLock } from "./lessonKeyboard";

/**
 * Who wins the keyboard, and the bug this file exists to keep dead (§4.2).
 *
 * The bug is that every one of the hundred lessons names a mode, so a resolver
 * read as a plain override beats the player's setting on all hundred rungs
 * while looking like a chain with three live arms.
 *
 * So the sweeps below are the point of the file rather than decoration. One
 * asserts that every unlocked lesson hands the choice back; the other that
 * every locked one keeps it and can say why. A regression that re-inverts the
 * chain fails ninety-odd assertions at once instead of none.
 */

/** Lesson 1: `guide`, locked — a child who has never seen a keyboard. */
const L01 = lessonById("L01")!;
/** Lesson 7: `guide`, and only suggesting it. */
const L07 = lessonById("L07")!;
/** Checkpoint 10: `off`, locked — reading the answers measures nothing. */
const L10 = lessonById("L10")!;

describe("keyboardFor", () => {
  it("reads the profile in free play, and defaults to guide", () => {
    expect(keyboardFor(null, "off")).toBe("off");
    expect(keyboardFor(null, "keys")).toBe("keys");
    // A profile made before the setting shipped, which is most of them.
    expect(keyboardFor(null, undefined)).toBe("guide");
  });

  it("seeds an unlocked lesson from the lesson", () => {
    expect(keyboardFor(L07, "off")).toBe("guide");
  });

  it("lets an unlocked lesson be run the way the child chose", () => {
    expect(keyboardFor(L07, "off", "off")).toBe("off");
    expect(keyboardFor(L07, undefined, "keys")).toBe("keys");
  });

  it("ignores a choice on a lesson that insists", () => {
    expect(keyboardFor(L01, "off", "off")).toBe("guide");
    expect(keyboardFor(L10, "guide", "guide")).toBe("off");
  });

  it("hands every unlocked lesson back to the player who chose", () => {
    const unlocked = LESSONS.filter((lesson) => !lesson.keyboardLocked);

    expect(unlocked.length).toBeGreaterThan(0);
    for (const lesson of unlocked)
      expect(keyboardFor(lesson, "guide", "off")).toBe("off");
  });

  it("keeps every locked lesson on its own mode", () => {
    const locked = LESSONS.filter((lesson) => lesson.keyboardLocked);

    expect(locked.length).toBeGreaterThan(0);
    for (const lesson of locked)
      expect(keyboardFor(lesson, "keys", "keys")).toBe(lesson.keyboard);
  });
});

describe("keyboardLock", () => {
  it("says nothing about a lesson that is only suggesting", () => {
    expect(keyboardLock(L07)).toBeNull();
  });

  /** A control greyed out with no reason is the bug that looks tidier. */
  it("gives the reason at both ends of the ladder", () => {
    expect(keyboardLock(L01)).toContain("new keys");
    expect(keyboardLock(L10)).toContain("Checkpoints");
  });

  it("has a reason for every lesson that insists", () => {
    for (const lesson of LESSONS.filter((l) => l.keyboardLocked))
      expect(keyboardLock(lesson)).toBeTruthy();
  });
});
