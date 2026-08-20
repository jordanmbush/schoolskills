import { describe, expect, it } from "vitest";

import { keyboardPresent, provesKeyboard } from "./useKeyboardPresence";

/**
 * The two rules that decide whether anybody is locked out of Hailstorm
 * (docs/typing.md §8.8, decision 53).
 *
 * Neither needs a browser, and that is the point of them being functions: what
 * `useKeyboardPresence` adds around these is a listener, a media query and a
 * `useState`, all of which a real device answers better than a fake one — the
 * browser half is measured in `e2e/smoke.mjs`. What is *decidable* here is the
 * asymmetry the story turns on: detection is a guess, and a guess that has
 * gone wrong must leave a child a way in rather than a locked door.
 */

describe("what proves a keyboard", () => {
  it("takes any keydown carrying a code", () => {
    for (const code of ["KeyA", "Space", "Escape", "F5", "ShiftLeft", "Tab"])
      expect(provesKeyboard({ code }), code).toBe(true);
  });

  it("takes neither of the two ways a browser says it has no idea", () => {
    // The two values left when there is no physical key behind the event:
    // `code` names a position on a keyboard, so it is empty when nothing on
    // one produced the keydown, and `Unidentified` is the fallback for a key
    // that cannot be named. Neither is proof — so a child typing their name
    // into a text field on a tablet has not opened the storm tile by
    // accident.
    expect(provesKeyboard({ code: "" })).toBe(false);
    expect(provesKeyboard({ code: "Unidentified" })).toBe(false);
  });

  it("is exactly the field the gun reads", () => {
    // `useStormClock` fires on `event.code` and nothing else, so proof and
    // playability are the same claim: a key that could not have shot a
    // hailstone is not evidence that one could be shot.
    expect(provesKeyboard({ code: undefined as unknown as string })).toBe(
      false,
    );
  });
});

describe("who is allowed in", () => {
  it("opens for a device that has proved itself, whatever the pointer says", () => {
    // The escape hatch, and the whole of "nobody is locked out by a bad
    // guess": a tablet in a keyboard folio reports the pointer of a tablet
    // until the first keystroke, and then it does not matter what it reports.
    expect(keyboardPresent(true, true)).toBe(true);
    expect(keyboardPresent(true, false)).toBe(true);
    expect(keyboardPresent(true, null)).toBe(true);
  });

  it("opens for anything it cannot answer", () => {
    // No `matchMedia`, or the server rendering the markup the page ships
    // with. Wrongly open is a tile that does nothing; wrongly shut is a child
    // with no way to argue, and the two are not the same size.
    expect(keyboardPresent(false, null)).toBe(true);
  });

  it("opens for a device with a pointer that hovers", () => {
    // A laptop with a touchscreen answers `any-pointer: coarse` and would be
    // caught by half of this query on its own.
    expect(keyboardPresent(false, false)).toBe(true);
  });

  it("shuts only for a touch-only device that has never seen a key", () => {
    // The one case out of six. It is the tablet, and it is still one keystroke
    // from being reopened.
    expect(keyboardPresent(false, true)).toBe(false);
  });
});
