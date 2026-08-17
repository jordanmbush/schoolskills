import { describe, expect, it } from "vitest";

import { InvalidInventory, MAX_NAME, create } from "./phonics";

/**
 * The pure half of the phonics service — what a parent may save, and what is
 * refused before anything reaches disk.
 *
 * `validate` runs before `create` awaits the store, so every case here is a
 * rejection that never opens IndexedDB. The half that does — the round trip
 * through the `inventories` store, and re-ticking a list that has since been
 * deleted — is covered in `storage/db.test.ts` against a fake one, which is the
 * same split `sheets.ts` and `decks.ts` are tested along.
 */

const SOME_SOUNDS = { sounds: ["s:s", "a:a"], tricky: [] };

describe("what may be saved", () => {
  it("insists the parent names the list", async () => {
    // Required, unlike a saved sheet's name — which the engine can write for
    // itself. Nothing but the parent can say what "where we've got to" is
    // called, so a blank is a refusal rather than a default.
    await expect(create({ name: " ", inventory: SOME_SOUNDS })).rejects.toThrow(
      InvalidInventory,
    );
    await expect(
      create({ name: "\t\n", inventory: SOME_SOUNDS }),
    ).rejects.toThrow(/name/i);
  });

  it("takes a name as long as a word list's, and not one longer", async () => {
    // The boundary itself: one character over is the only way anybody ever
    // meets this message, and it is the branch nothing exercised.
    await expect(
      create({ name: "x".repeat(MAX_NAME + 1), inventory: SOME_SOUNDS }),
    ).rejects.toThrow(new RegExp(`${MAX_NAME} characters or fewer`));
  });

  it("refuses a list with nothing on it", async () => {
    await expect(
      create({ name: "Nothing yet", inventory: { sounds: [], tricky: [] } }),
    ).rejects.toThrow(/at least one sound/i);
    // Held to the engine's reading of an inventory: `ai:e` is in the table so
    // `said` can be described honestly, and is not something a parent can tick.
    // A list of nothing but untickable spellings is an empty list.
    await expect(
      create({
        name: "Everything",
        inventory: { sounds: ["ai:e"], tricky: [] },
      }),
    ).rejects.toThrow(/at least one sound/i);
  });
});
