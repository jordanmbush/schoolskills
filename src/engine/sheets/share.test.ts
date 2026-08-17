import { describe, expect, it } from "vitest";

import { encodeSharedSheet, type SharedSheet } from "./share";
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
