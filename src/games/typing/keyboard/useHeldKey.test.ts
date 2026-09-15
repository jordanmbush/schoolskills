import { describe, expect, it, vi } from "vitest";

import { createHoldWatch } from "./useHeldKey";

/**
 * What the run has to be able to trust about the key it asked for (§5.8).
 *
 * Two things are pinned: that the held key never types — its keydown is
 * cancelled every time, repeats included — and that every other key is left
 * alone, because the free hand has to keep typing through it.
 */

function watch(code = "KeyF") {
  let held = false;
  const machine = createHoldWatch(code, (next) => {
    held = next;
  });
  const press = (key: string) => {
    const preventDefault = vi.fn();
    machine.keydown({ code: key, preventDefault });
    return preventDefault;
  };
  return {
    press,
    lift: (key: string) => machine.keyup({ code: key }),
    release: machine.release,
    held: () => held,
  };
}

describe("createHoldWatch", () => {
  it("is held from the press to the release", () => {
    const f = watch();
    expect(f.held()).toBe(false);
    f.press("KeyF");
    expect(f.held()).toBe(true);
    f.lift("KeyF");
    expect(f.held()).toBe(false);
  });

  it("cancels the held key so it never types, repeats included", () => {
    const f = watch();
    expect(f.press("KeyF")).toHaveBeenCalledTimes(1);
    // Auto-repeat: the same keydown again, thirty times a second.
    expect(f.press("KeyF")).toHaveBeenCalledTimes(1);
    expect(f.held()).toBe(true);
  });

  it("leaves every other key exactly as it was", () => {
    const f = watch();
    f.press("KeyF");
    expect(f.press("KeyJ")).not.toHaveBeenCalled();
    expect(f.press("Space")).not.toHaveBeenCalled();
    expect(f.held()).toBe(true);
    // Lifting some other key is not letting go.
    f.lift("KeyJ");
    expect(f.held()).toBe(true);
  });

  /** A lost window is read as a release: the run can no longer tell. */
  it("lets go when the window does", () => {
    const f = watch();
    f.press("KeyF");
    f.release();
    expect(f.held()).toBe(false);
  });

  it("is never held by a key it was not asked about", () => {
    const j = watch("KeyJ");
    j.press("KeyF");
    expect(j.held()).toBe(false);
  });
});
