/**
 * Phonics' front door.
 *
 * Three modules behind it, and the split is the one `words/` already uses: the
 * table of what letters say (`sounds.ts`), the words cut into those spellings
 * (`bank.ts`), and what a parent has taught plus the generation it constrains
 * (`inventory.ts`).
 *
 * Everything above the engine comes through here — the sheet family, the tick
 * list that builds an inventory, and the service that saves one — so that none
 * of them has to know which module a fact lives in, and so the model can be
 * re-cut without a screen noticing.
 *
 * Two modules joined the three when the sheets arrived, and both are about
 * *printing* rather than about the model: `sentences.ts`, the connected text a
 * child can read, which is the one thing the bank and an inventory could not
 * between them derive; and `cards.ts`, which cuts a word into the pieces a
 * sheet sets it in and states how tall they stand. `sheets.ts` is the family
 * itself and is reached through `engine/sheets/index.ts` like every other one,
 * not through here.
 */
export {
  CORRESPONDENCES,
  CORRESPONDENCES_BY_GRAPHEME,
  CORRESPONDENCE_BY_ID,
  PHONEMES,
  PHONEME_BY_ID,
  defaultSpelling,
  graphemeParts,
  graphemeText,
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
  CARD_BIG_EMS,
  CARD_BIG_LEADING,
  CARD_PAD_EMS,
  CARD_SMALL_EMS,
  CARD_SMALL_LEADING,
  STRIP_BIG_EMS,
  cardRowEms,
  markGrapheme,
  markSentence,
  markSpelling,
  markWord,
  markedText,
} from "./cards";

export {
  SENTENCES,
  canReadSentence,
  pickSentences,
  sentenceText,
  sentenceWords,
  type Sentence,
} from "./sentences";

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
