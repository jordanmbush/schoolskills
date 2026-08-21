import { describe, expect, it } from "vitest";

import { countNote } from "./Find";

/**
 * What the search box is allowed to say before it can answer.
 *
 * The island paints its field before the index arrives, which opens a window
 * where a parent can type into a search that has nothing to search yet.
 * Everything below is about that window and the one after a failed fetch.
 */
describe("countNote", () => {
  it("says nothing until something has been asked for", () => {
    expect(countNote("ready", false, 0)).toBe("");
    expect(countNote("loading", false, 0)).toBe("");
    expect(countNote("failed", false, 0)).toBe("");
  });

  it("does not report a count for an index that has not landed", () => {
    // The bug this guards: `0 sheets` announced over a catalog of 119.
    expect(countNote("loading", true, 0)).toBe("Still loading the catalog…");
  });

  it("stays quiet when the fetch failed, so the note below speaks alone", () => {
    // Polite region + failure note would otherwise repeat the bad news once
    // per keystroke, and contradict it with a count of zero.
    expect(countNote("failed", true, 0)).toBe("");
  });

  it("counts once the catalog is here, singular and plural", () => {
    expect(countNote("ready", true, 0)).toBe("0 sheets");
    expect(countNote("ready", true, 1)).toBe("1 sheet");
    expect(countNote("ready", true, 7)).toBe("7 sheets");
  });
});
