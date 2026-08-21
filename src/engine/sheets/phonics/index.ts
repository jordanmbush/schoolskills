/**
 * Phonics' front door.
 *
 * Everything above the engine comes through here — the sheet family, the tick
 * list that builds an inventory, and the service that saves one — so that none
 * of them has to know which module a fact lives in, and the model can be re-cut
 * without a screen noticing.
 *
 * `sheets.ts` is the exception: it is the sheet family, and it is reached
 * through `engine/sheets/index.ts` like every other one.
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
