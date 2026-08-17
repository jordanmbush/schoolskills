import { describe, expect, it } from "vitest";

import {
  MAX_SHARE_PAYLOAD,
  decodeSharedSheet,
  encodeSharedSheet,
  type SharedSheet,
} from "./share";
import type { MultiplicationConfig } from "./types";

/**
 * The link a catalog page hands to the builder.
 *
 * Nothing here checks the encoder against the encoder. Every assertion works
 * backwards from the string that ships: it is decoded with the platform's own
 * `atob` rather than with a matching decoder written beside the encoder, which
 * is what makes "a parent who follows this link gets this sheet" a property of
 * the output rather than of a pair of functions that agree with each other.
 */

const config: MultiplicationConfig = {
  kind: "multiplication",
  paper: { size: "letter", orientation: "portrait", margin: "normal" },
  fontPt: 12,
  fields: ["name", "date"],
  operation: "multiply",
  style: "standard",
  form: "horizontal",
  tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  factors: { min: 1, max: 12 },
  count: 30,
  columns: 3,
};

/** base64url back to the object, the way a reader with no code would do it. */
function decode(payload: string): SharedSheet {
  const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as SharedSheet;
}

describe("a shared sheet", () => {
  it("comes back as the sheet that was shared", () => {
    const shared = { config, seed: 7 };
    expect(decode(encodeSharedSheet(shared))).toEqual(shared);
  });

  it("says which one of the sheets that config makes was meant", () => {
    // §7: "another sheet like this one" is `seed + 1`, so a link that dropped
    // the seed would offer that by accident to everybody who followed it.
    expect(decode(encodeSharedSheet({ config, seed: 41 })).seed).toBe(41);
  });

  it("uses only characters that survive a URL", () => {
    // Base64url's whole point: no `+`, no `/`, no `=` for something in the
    // middle of a link to re-encode or a reader to mistype.
    expect(encodeSharedSheet({ config, seed: 0 })).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("carries a title somebody typed in their own language", () => {
    // `btoa` speaks in code units below 256, so anything past ASCII has to be
    // UTF-8 before it gets there — a parent who titled a sheet "Répétition"
    // would otherwise get an exception instead of a link.
    const titled = { ...config, title: "Répétition — 7×8" };
    expect(
      decode(encodeSharedSheet({ config: titled, seed: 1 })).config,
    ).toEqual(titled);
  });

  it("holds nothing about the child the sheet is for", () => {
    // §1. The name line is printed blank and filled in by hand; a shared link
    // is the surface where that would otherwise leak, and there is nowhere in
    // a config to put one.
    const payload = decode(encodeSharedSheet({ config, seed: 3 }));
    expect(JSON.stringify(payload)).not.toMatch(/name"\s*:\s*"[^"]/);
  });
});

/**
 * The other half: what the builder does with whatever is after `#s=`.
 *
 * A fragment is untrusted input — it is whatever was in the address bar — and
 * the failure being guarded against is not a stolen secret but a builder that
 * throws on load and shows a parent a blank page instead of a worksheet. So
 * every case below asserts the same thing in a different costume: it answers,
 * and it answers with something a sheet can be built from.
 */
describe("reading a shared sheet back", () => {
  const encoded = (shared: unknown) => encodeSharedSheet(shared as SharedSheet);

  it("returns the sheet that was shared", () => {
    const shared = { config, seed: 7 };
    expect(decodeSharedSheet(encodeSharedSheet(shared))).toEqual(shared);
  });

  it("answers null rather than throwing on anything that isn't one", () => {
    // Not base64, not JSON, not an object, no config, no kind — five ways of
    // saying "whatever that was, the encoder did not write it".
    for (const payload of [
      "",
      "!!!!",
      encoded(42),
      encoded({ seed: 1 }),
      encoded({ config: {}, seed: 1 }),
      encoded({ config, seed: "soon" }),
      encoded({ config, seed: -1 }),
      encoded({ config, seed: 1.5 }),
    ]) {
      expect(decodeSharedSheet(payload)).toBeNull();
    }
  });

  it("caps how much it will decode", () => {
    expect(decodeSharedSheet("A".repeat(MAX_SHARE_PAYLOAD + 1))).toBeNull();
  });

  it("replaces a paper size it has never heard of rather than carrying it", () => {
    // The whole point of rebuilding the shared half rather than checking it: a
    // config saying `size: "foolscap"` reaches `pageSize` on the very next
    // line, and a preview that threw there is a bench that never opens.
    const shared = decodeSharedSheet(
      encoded({
        config: { ...config, paper: { size: "foolscap", orientation: 7 } },
        seed: 1,
      }),
    );
    expect(shared?.config.paper).toEqual({
      size: "letter",
      orientation: "portrait",
      margin: "normal",
    });
  });

  it("holds the type size inside what a sheet can be set at", () => {
    const huge = decodeSharedSheet(
      encoded({ config: { ...config, fontPt: 4000 }, seed: 1 }),
    );
    expect(huge?.config.fontPt).toBe(36);
  });

  it("keeps the family's own fields", () => {
    // Deliberately untouched: every family already treats its config as
    // untrusted, because a config from a saved sheet always could be. Two
    // validators would be one too many, and the second one goes stale.
    const shared = decodeSharedSheet(encodeSharedSheet({ config, seed: 2 }));
    expect((shared?.config as MultiplicationConfig).tables).toEqual(
      config.tables,
    );
  });

  it("prints no line the sheet did not ask for", () => {
    // §1 from the reading end. A payload naming a field this build doesn't have
    // gets none of it, and the three real ones come back in the printed order
    // however they were written down.
    const shared = decodeSharedSheet(
      encoded({
        config: { ...config, fields: ["class", "parent", "name", "name"] },
        seed: 1,
      }),
    );
    expect(shared?.config.fields).toEqual(["name", "class"]);
  });

  it("clips a title long enough to be an essay", () => {
    const shared = decodeSharedSheet(
      encoded({ config: { ...config, title: "x".repeat(500) }, seed: 1 }),
    );
    expect(shared?.config.title).toHaveLength(120);
  });
});
