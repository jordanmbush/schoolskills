import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Profile } from "@/engine/types";

import { KeyboardSetting } from "./KeyboardSetting";

/**
 * The setting, and the profile that predates it.
 *
 * `Profile.keyboard` is optional and gets no migration on purpose
 * (docs/typing.md §10): profiles are read straight out of IndexedDB, unlike
 * sessions, and the only copy of a child's record book is the one on their
 * device. The price of that decision is that "the field isn't there" is a
 * state the UI meets forever, not a state that gets tidied up one release
 * later — so it is pinned here, in the file that resolves it.
 *
 * The other assertion is that this is a control. The board it governs is sixty
 * inert spans and must stay that way (§4.5); the thing that shows and hides it
 * is the opposite, and "reachable by keyboard, announced with a name" is the
 * difference between the two.
 */

/** A player from before this shipped: every field but `keyboard`. */
const legacy: Profile = {
  id: "kid-1",
  name: "Ada",
  emoji: "🚀",
  color: "#7c3aed",
  age: 7,
  soundOn: true,
  xp: 340,
  badges: ["first-race"],
  createdAt: "2026-03-01T09:00:00.000Z",
};

/** Which pill is selected, read back off the radio that carries `checked`. */
const chosen = (html: string) =>
  html
    .split("<input")
    .filter((chunk) => chunk.includes("checked"))
    .map((chunk) => /value="([^"]+)"/.exec(chunk)?.[1]);

describe("KeyboardSetting", () => {
  it("renders a profile that has no keyboard field, on guide", () => {
    // `legacy.keyboard` is `undefined`, which is exactly what the profile
    // store hands back for a record written before the field existed.
    const html = renderToStaticMarkup(
      <KeyboardSetting mode={legacy.keyboard} onChange={() => {}} />,
    );

    // One pill selected, not none: a radiogroup with nothing checked would
    // also "render without error", and it would leave a child looking at a
    // setting that claims not to be on any of its three settings.
    expect(chosen(html)).toEqual(["guide"]);
    expect(html).toContain("Show the next key");
  });

  it("shows the mode a player has chosen", () => {
    const html = renderToStaticMarkup(
      <KeyboardSetting mode="off" onChange={() => {}} />,
    );
    expect(chosen(html)).toEqual(["off"]);
  });

  it("is a named radio group, because this one is a control", () => {
    const html = renderToStaticMarkup(
      <KeyboardSetting mode="keys" onChange={() => {}} />,
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Keyboard"');
    // Three real radios sharing one name — arrow keys move between them and
    // the set is a single tab stop. A row of buttons announces as three
    // unrelated toggles and costs three stops.
    expect(html.match(/type="radio"/g)?.length).toBe(3);
    expect(
      new Set([...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1])).size,
    ).toBe(1);
  });
});
