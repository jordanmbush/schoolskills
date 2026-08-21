import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KEYS } from "@/engine/keyboard";

import { LiveKeyboard } from "./LiveKeyboard";

/**
 * The one decision this component makes: who gets the hint (§4.1).
 *
 * Everything else about the board is pinned next door — `Keyboard.test.tsx`
 * owns the picture and the palette, `useKeyEcho.test.ts` owns the flash and
 * the release timer. What is only true here is that "keys" and "guide" differ
 * in the hint and in NOTHING else.
 *
 * The echo is absent from every case below for the same reason it is absent
 * from a real first frame: `useKeyEcho` wires itself up in an effect, and no
 * key has been struck yet.
 */

/** Which keys the hint lit, by code — the board draws `KEYS` in order. */
const hinted = (html: string) => {
  const classes = [...html.matchAll(/class="(keyboard__key[^"]*)"/g)];
  return KEYS.filter((_, index) => classes[index][1].includes("is-next")).map(
    (key) => key.code,
  );
};

describe("LiveKeyboard", () => {
  it("points at the next key in guide", () => {
    const html = renderToStaticMarkup(<LiveKeyboard mode="guide" next="f" />);
    expect(hinted(html)).toEqual(["KeyF"]);
  });

  it("draws the same board in keys, pointing at nothing", () => {
    const html = renderToStaticMarkup(<LiveKeyboard mode="keys" next="f" />);

    // The board is all there — the mode withholds the hint, not the map.
    expect(html.match(/class="keyboard__key/g)).toHaveLength(KEYS.length);
    expect(hinted(html)).toEqual([]);
  });

  it("points at nothing when the passage is waiting on nothing", () => {
    // The 3·2·1, the quit sheet, the moment after the last word: `TypingTrack`
    // hands `null` in every state where the field is disabled.
    const html = renderToStaticMarkup(
      <LiveKeyboard mode="guide" next={null} />,
    );
    expect(hinted(html)).toEqual([]);
  });

  it("stays a picture, with nothing to focus", () => {
    // The load-bearing one on a phone: the OS keyboard is raised by the
    // focused `<input>`, so anything focusable down here could take the real
    // keyboard away mid-run.
    const html = renderToStaticMarkup(<LiveKeyboard mode="guide" next=" " />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("tabindex");
  });
});
