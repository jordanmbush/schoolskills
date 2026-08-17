/**
 * Phonics' front door.
 *
 * Three modules behind it, and the split is the one `words/` already uses: the
 * table of what letters say (`sounds.ts`), the words cut into those spellings
 * (`bank.ts`), and what a parent has taught plus the generation it constrains
 * (`inventory.ts`).
 *
 * Everything above the engine comes through here — the sheet families in
 * PRINT25, the tick list that builds an inventory, and the service that saves
 * one — so that none of them has to know which module a fact lives in, and so
 * the model can be re-cut without a screen noticing. There is no `SheetSpec`
 * here yet: a sound inventory is not a sheet, it is what several sheets are
 * built out of, and the families that consume it are the next story.
 */
export {
  CORRESPONDENCES,
  CORRESPONDENCES_BY_GRAPHEME,
  CORRESPONDENCE_BY_ID,
  PHONEMES,
  PHONEME_BY_ID,
  defaultSpelling,
  graphemeParts,
  isTeachable,
  spellingId,
  type Correspondence,
  type Phoneme,
} from "./sounds";

export {
  WORDS,
  WORD_BY_SPELLING,
  isTricky,
  variesByAccent,
  wordSounds,
  type Word,
} from "./bank";

export {
  EMPTY_INVENTORY,
  MAX_TRICKY,
  allSounds,
  canRead,
  decodable,
  pickWords,
  readInventory,
  taughtSounds,
  type Inventory,
  type SavedInventory,
  type WordPick,
} from "./inventory";
