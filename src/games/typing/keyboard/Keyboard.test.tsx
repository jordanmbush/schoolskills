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
 *
 * That split is per BLOCK, not per file: the board is scenery and borrows none
 * of the five, and the press echo below it is signal and borrows exactly two.
 * So the scenery assertion reads the board's own block and stops where the
 * echo's begins — a slice to the end of the file would forbid the very colours
 * §4.3 requires.
 */

const html = renderToStaticMarkup(<Keyboard />);

const css = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../styles/${name}`, import.meta.url)),
    "utf8",
  );

/** Where the board's own rules start in the game stylesheet, and where they end. */
const KEYBOARD_BLOCK = "/* ── Typing: the keyboard on screen";
const HINT_BLOCK = "/* ── Typing: the next-key hint";
const ECHO_BLOCK = "/* ── Typing: press echo";

/**
 * Which key codes the hint lights for a character, in board order.
 *
 * The board draws `KEY_ROWS` flattened, which is `KEYS`, so the nth rendered
 * cap is the nth key in the table — the codes never reach the markup (they
 * would be sixty attributes nothing reads), and this is how a class gets named
 * back to the key that wears it.
 */
const hinted = (next: string | null) => {
  const lit = renderToStaticMarkup(<Keyboard next={next} />);
  const classes = [...lit.matchAll(/class="(keyboard__key[^"]*)"/g)];
  return KEYS.filter((_, index) => classes[index][1].includes("is-next")).map(
    (key) => key.code,
  );
};

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
    const block = game.slice(
      game.indexOf(KEYBOARD_BLOCK),
      game.indexOf(HINT_BLOCK),
    );

    expect(game).toContain(KEYBOARD_BLOCK);
    expect(game).toContain(HINT_BLOCK);
    expect(game).toContain(ECHO_BLOCK);
    for (const name of Object.keys(TELEMETRY))
      expect(block).not.toContain(`var(${name})`);
  });

  it("flashes a struck key green and a wrong one red, and nothing else", () => {
    const game = css("game.css");
    const echo = game.slice(game.indexOf(ECHO_BLOCK));

    // The two the echo is allowed, in the two places they mean something.
    expect(echo).toMatch(/\.is-down\s*{[^}]*var\(--lime\)/);
    expect(echo).toMatch(/\.is-wrong\s*{[^}]*var\(--flare\)/);

    // And no others: a board that borrowed `--sky` or `--gold` would be
    // claiming a ghost or a record over a keystroke.
    for (const name of ["--sky", "--gold", "--grape"])
      expect(echo).not.toContain(`var(${name})`);
  });

  it("lights the codes it is handed, and flares the wrong ones", () => {
    const lit = renderToStaticMarkup(
      <Keyboard
        down={new Set(["KeyF", "ShiftRight"])}
        wrong={new Set(["KeyF"])}
      />,
    );

    // A wrong key is still a key that went down — the echo publishes it in
    // both sets, and the board writes both classes.
    expect(lit).toContain("keyboard__key is-home is-down is-wrong");
    expect(lit).toContain("is-word is-down");
    expect(lit.match(/is-down/g)).toHaveLength(2);
    expect(lit.match(/is-wrong/g)).toHaveLength(1);
  });

  it("points at the next key in `--go`, and not in a press colour", () => {
    const game = css("game.css");
    const hint = game.slice(game.indexOf(HINT_BLOCK), game.indexOf(ECHO_BLOCK));

    // `--go` is per-world and already means "press this" — the button that
    // started the run is the same colour. A hint drawn in `--lime` would be
    // indistinguishable from the flash that says "you just pressed that".
    expect(hint).toMatch(/\.is-next\s*{/);
    expect(hint).toContain("var(--go)");
    for (const name of Object.keys(TELEMETRY))
      expect(hint).not.toContain(`var(${name})`);

    // And the hint is written ABOVE the echo, so a hinted key that is struck
    // flashes rather than staying dressed as an instruction.
    expect(game.indexOf(HINT_BLOCK)).toBeLessThan(game.indexOf(ECHO_BLOCK));
  });

  it("lights the single key a plain character is typed with", () => {
    expect(hinted("f")).toEqual(["KeyF"]);
    expect(hinted(" ")).toEqual(["Space"]);
  });

  it("lights a shifted character's letter AND the shift on the other hand", () => {
    // The whole point of the hint. Left-pinky shift plus left-pinky `a` is
    // physically impossible, so `A` is right-shift-plus-left-`a` — and which
    // hand takes the shift is what typing courses for children skip.
    expect(hinted("A")).toEqual(["KeyA", "ShiftRight"]);

    // The mirror, so this can't pass by always naming the right shift: `?` is
    // the right pinky's, so the LEFT shift is the reachable one.
    expect(hinted("?")).toEqual(["ShiftLeft", "Slash"]);
  });

  it("lights nothing for no expectation, or a key this board hasn't got", () => {
    // Nothing expected: the run hasn't started, or has finished.
    expect(hinted(null)).toEqual([]);

    // A curly quote that survived the passage filter. `strokeFor` answers
    // null, and null lights nothing rather than throwing (§3.3).
    expect(hinted("“")).toEqual([]);
  });

  it("keeps the hint on the key being struck, and stacks it under the flash", () => {
    const lit = renderToStaticMarkup(
      <Keyboard next="f" down={new Set(["KeyF"])} />,
    );

    expect(lit).toContain("keyboard__key is-home is-next is-down");
  });

  it("draws a resting board when nobody is typing", () => {
    expect(html).not.toContain("is-down");
    expect(html).not.toContain("is-wrong");
    expect(html).not.toContain("is-next");
  });
});
