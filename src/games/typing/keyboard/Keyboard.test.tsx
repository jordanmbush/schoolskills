import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KEYS } from "@/engine/keyboard";

import { Keyboard } from "./Keyboard";

/**
 * What the board owes a child, a screen reader, and the next story.
 *
 * The two things worth pinning here are both things a well-meaning change
 * would undo. The first is that this board is INERT: no control, no tab stop,
 * nothing to press. "Make the keys tappable" is the single most natural
 * feature request this component will ever attract, and saying yes to it turns
 * a touch-typing tutor into a hunt-and-peck trainer (docs/typing.md §4.5).
 *
 * The second is the palette. The finger hues are checked against the telemetry
 * five by reading the stylesheet, because that rule lives in CSS and there is
 * no other place it can be asserted — a keyboard that tinted the left index
 * finger `--lime` would spend a hundred lessons teaching a child to unlearn
 * what green means (§4.6).
 */

const html = renderToStaticMarkup(<Keyboard />);

const css = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../styles/${name}`, import.meta.url)),
    "utf8",
  );

/** Where the board's own rules start in the game stylesheet. */
const KEYBOARD_BLOCK = "/* ── Typing: the keyboard on screen";

/** The five that mean something everywhere, by name and by value. */
const TELEMETRY = {
  "--lime": "#c8ff41",
  "--flare": "#ff4d6d",
  "--sky": "#4cc4ff",
  "--gold": "#ffc53d",
  "--grape": "#a78bfa",
};

describe("Keyboard", () => {
  it("is a picture, not sixty announcements", () => {
    expect(html).toContain('aria-hidden="true"');
  });

  it("is not tappable — no control, no tab stop, no role", () => {
    expect(html).not.toContain("<button");
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("role=");
  });

  it("draws every key the engine defines, and no others", () => {
    const drawn = html.match(/class="keyboard__key/g) ?? [];
    expect(drawn).toHaveLength(KEYS.length);
  });

  it("takes its geometry from the engine rather than from CSS", () => {
    // `f` is 4.75 units in and one wide; the space bar is 6.25 wide. Both are
    // written on the element, so the stagger can't drift from the table.
    expect(html).toContain("--x:4.75");
    expect(html).toContain("--w:6.25");
  });

  it("marks the eight home keys and the space bar, and nothing else", () => {
    const marked = html.match(/is-home/g) ?? [];
    expect(marked).toHaveLength(KEYS.filter((k) => k.home).length);
    expect(marked).toHaveLength(9);
  });

  it("names the finger on every key, so the tint has something to hang on", () => {
    for (const key of KEYS)
      expect(html).toContain(`data-finger="${key.finger}"`);
  });

  it("has eight finger hues, and not one of them is a telemetry colour", () => {
    const declarations = [
      ...css("tokens.css").matchAll(/(--finger-[a-z-]+):\s*([^;]+);/g),
    ];

    // Eight, not nine: either thumb presses the space bar, so a hue there
    // would be naming a choice the technique does not make.
    expect(declarations).toHaveLength(8);
    expect(declarations.map(([, name]) => name)).not.toContain(
      "--finger-thumb",
    );

    for (const [, , value] of declarations)
      for (const [name, hex] of Object.entries(TELEMETRY)) {
        expect(value).not.toContain(name);
        expect(value.toLowerCase()).not.toContain(hex);
      }
  });

  it("draws the board out of world tokens, borrowing none of the five", () => {
    const game = css("game.css");
    const block = game.slice(game.indexOf(KEYBOARD_BLOCK));

    expect(game).toContain(KEYBOARD_BLOCK);
    for (const name of Object.keys(TELEMETRY))
      expect(block).not.toContain(`var(${name})`);
  });
});
