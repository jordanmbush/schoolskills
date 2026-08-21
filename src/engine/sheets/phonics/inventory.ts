/**
 * A sound inventory: what this child has been taught, and nothing else — the
 * mechanism the whole phonics family is built on (docs/printables.md §13).
 *
 * Two lists, because English has two kinds of word. `sounds` is what has been
 * *taught to decode*, as correspondence ids from `sounds.ts`, and a word is
 * available when every spelling in it is on that list — not when its letters
 * are, which is the distinction the whole model turns on: a child who knows
 * `c`, `a`, `t` and `h` can read `cat` and cannot read `chat`.
 *
 * `tricky` is the parent's own list of words taught by sight, and it is the
 * only door a word with an `odd` spelling can come through. The rule is never
 * bent to admit one: `said` is not decodable because a parent ticked `ai`, and
 * never becomes so.
 *
 * A saved inventory *is* the preset — a name plus a set of sounds, both of them
 * the parent's, kept by `services/phonics.ts`. None is shipped.
 */
import { mulberry32, shuffled } from "@/engine/random";

import { WORDS, isTricky, variesByAccent, wordSounds, type Word } from "./bank";
import {
  CORRESPONDENCES,
  CORRESPONDENCE_BY_ID,
  isTeachable,
  type Correspondence,
} from "./sounds";

export type Inventory = {
  /** Correspondence ids, in the order they were taught where that is known. */
  sounds: string[];
  /** Whole words taught by sight, lower case. */
  tricky: string[];
};

/**
 * A named inventory a parent kept.
 *
 * The same shape as a `SavedSheet`, and scoped the same way: to the household
 * rather than to a child, because one family teaches one sequence and a second
 * child arriving at the same point uses the same list.
 */
export type SavedInventory = Inventory & {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

/** Where a parent starts: nothing taught yet, so nothing may be printed. */
export const EMPTY_INVENTORY: Inventory = { sounds: [], tricky: [] };

/** As many sight words as a parent may put in a deck — `services/decks.ts`. */
export const MAX_TRICKY = 200;

/** Long enough for `elephant`; anything longer is not an early reader's word. */
const MAX_TRICKY_LETTERS = 20;

/**
 * Everything the table can teach — what a sheet uses when a parent hasn't said
 * where they are, and what "tick them all" produces.
 *
 * Deliberately unnamed, so that it is not a preset. The `odd` spellings stay
 * out because they are not teachable in the first place, and every word behind
 * them is reachable through `tricky` anyway.
 */
export function allSounds(): Inventory {
  return {
    sounds: CORRESPONDENCES.filter(isTeachable).map((entry) => entry.id),
    tricky: WORDS.filter(isTricky).map((entry) => entry.word),
  };
}

/**
 * Makes an inventory safe to build a sheet from, whatever it arrived as.
 *
 * The untrusted door, and there are three of them: a shared `#s=` URL, a saved
 * sheet from a build ago, and a record read back out of IndexedDB. Everything
 * that isn't a spelling this build knows about is dropped rather than refused —
 * a sound retired between two releases must narrow the sheet, not stop it
 * printing — and an `odd` spelling is dropped because ticking `ai:e` would make
 * `said` decodable, and it isn't.
 */
export function readInventory(value: unknown): Inventory {
  const raw = (value ?? {}) as Partial<Inventory>;
  const sounds = new Set<string>();
  for (const id of Array.isArray(raw.sounds) ? raw.sounds : []) {
    if (typeof id !== "string") continue;
    const found = CORRESPONDENCE_BY_ID.get(id);
    if (found && isTeachable(found)) sounds.add(id);
  }

  const tricky = new Set<string>();
  for (const word of Array.isArray(raw.tricky) ? raw.tricky : []) {
    if (typeof word !== "string") continue;
    const clean = word.trim().toLowerCase().slice(0, MAX_TRICKY_LETTERS);
    if (clean) tricky.add(clean);
    if (tricky.size === MAX_TRICKY) break;
  }

  return { sounds: [...sounds], tricky: [...tricky] };
}

/** The spellings on the list, in table order — what a wall chart prints. */
export function taughtSounds(inventory: Inventory): Correspondence[] {
  const held = new Set(inventory.sounds);
  return CORRESPONDENCES.filter((entry) => held.has(entry.id));
}

/**
 * Can this child read this word?
 *
 * Every spelling taught, or the whole word learnt by sight. The `has` is over a
 * set the caller may hand in, because the question is asked once per word in
 * the bank per sheet and rebuilding the set three hundred times is the kind of
 * thing that turns a live preview into a stutter.
 */
export function canRead(
  entry: Word,
  inventory: Inventory,
  taught: Set<string> = new Set(inventory.sounds),
  sight: Set<string> = new Set(inventory.tricky),
): boolean {
  if (sight.has(entry.word)) return true;
  return entry.parts.every((part) => taught.has(part));
}

/**
 * Every word in the bank this child can read, in bank order — which is roughly
 * teaching order. A caller wanting a spread takes `pickWords` instead.
 */
export function decodable(inventory: Inventory): Word[] {
  const taught = new Set(inventory.sounds);
  const sight = new Set(inventory.tricky);
  return WORDS.filter((entry) => canRead(entry, inventory, taught, sight));
}

export type WordPick = {
  /** How many to put on the page. Fewer come back if fewer can be read. */
  count: number;
  /**
   * Only words using this spelling — "this week we're doing `sh`". A sheet
   * about a sound the parent hasn't ticked comes back empty rather than
   * quietly ignoring the request, which is the answer that shows up on screen
   * as an empty sheet instead of a wrong one.
   */
  focus?: string;
  /**
   * Let sight words in. Off by default: the point of a decodable sheet is that
   * every word on it can be sounded out, and a dictation line is the one place
   * `said` belongs.
   */
  tricky?: boolean;
  /** At most this many sounds, for the first sheets a child ever does. */
  maxSounds?: number;
  /**
   * Only words the two varieties in `sounds.ts` agree about. For the one
   * exercise that needs it — telling two sounds apart — and off elsewhere,
   * because it would otherwise throw away `dog`.
   */
  sameEverywhere?: boolean;
};

/**
 * Words for a sheet: readable, matching the options, in an order the seed
 * decides — deterministic in `(inventory, options, seed)`, so `seed + 1` is
 * "another one like this" (§7). No word twice.
 */
export function pickWords(
  inventory: Inventory,
  options: WordPick,
  seed: number,
): Word[] {
  const taught = new Set(inventory.sounds);
  const sight = new Set(inventory.tricky);
  const pool = WORDS.filter((entry) => {
    if (!canRead(entry, inventory, taught, sight)) return false;
    if (!options.tricky && isTricky(entry)) return false;
    if (options.focus && !entry.parts.includes(options.focus)) return false;
    if (options.sameEverywhere && variesByAccent(entry)) return false;
    if (options.maxSounds && wordSounds(entry).length > options.maxSounds)
      return false;
    return true;
  });
  return shuffled(pool, mulberry32(seed)).slice(0, Math.max(0, options.count));
}
