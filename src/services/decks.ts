import { setCustomLists } from "@/engine/decks/words";
import { WORD_LISTS_BY_ID } from "@/engine/decks/wordlists";
import { normaliseWord } from "@/engine/decks/words";
import type { CustomDeck } from "@/engine/types";

import * as store from "./storage/db";

/**
 * Word lists a parent typed in.
 *
 * The only writer of the engine's custom-list mirror — every function that
 * changes a deck re-mirrors before returning, so no caller has to remember to.
 * See `setCustomLists` for why the mirror exists.
 */

export class InvalidDeck extends Error {}

/** Enough to be a deck. Below this a "spot it" round has nothing to spot. */
export const MIN_WORDS = 2;
export const MAX_WORDS = 200;
export const MAX_NAME = 40;

const nextId = () =>
  `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Splits whatever a parent pasted into words.
 *
 * Newlines, commas, tabs and semicolons all work, because the list is coming
 * off a school letter or an email and nobody should have to reformat it. Order
 * is kept — a spelling list is often taught in order — but duplicates go,
 * comparing the way the marker will.
 */
export function parseWords(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\n,;\t]+/)) {
    const word = raw.trim().replace(/\s+/g, " ");
    if (!word) continue;
    const key = normaliseWord(word);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out;
}

export type DeckInput = { name: string; emoji: string; words: string[] };

function validate(input: DeckInput): DeckInput {
  const name = input.name.trim();
  if (!name) throw new InvalidDeck("Give the list a name");
  if (name.length > MAX_NAME)
    throw new InvalidDeck(`Name must be ${MAX_NAME} characters or fewer`);

  const words = input.words.map((w) => w.trim()).filter(Boolean);
  if (words.length < MIN_WORDS)
    throw new InvalidDeck(`A list needs at least ${MIN_WORDS} words`);
  if (words.length > MAX_WORDS)
    throw new InvalidDeck(`That's more than ${MAX_WORDS} words`);
  // A word with a space in it can't be marked fairly: nothing on the card
  // tells the speller a space is expected, and a missing one reads as a
  // misspelling. The same reason the shipped lists have none.
  const spaced = words.find((w) => w.includes(" "));
  if (spaced) throw new InvalidDeck(`"${spaced}" has a space in it`);

  return { name, emoji: input.emoji.trim() || "✏️", words };
}

async function mirror(decks: CustomDeck[]) {
  setCustomLists(decks);
  return decks;
}

export async function all(): Promise<CustomDeck[]> {
  const decks = (await store.allDecks()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  return mirror(decks);
}

export async function create(input: DeckInput): Promise<CustomDeck> {
  const clean = validate(input);
  const now = new Date().toISOString();
  const deck: CustomDeck = {
    id: nextId(),
    ...clean,
    createdAt: now,
    updatedAt: now,
  };
  await store.putDeck(deck);
  await all();
  return deck;
}

export async function update(
  id: string,
  input: DeckInput,
): Promise<CustomDeck> {
  const existing = (await store.allDecks()).find((d) => d.id === id);
  if (!existing) throw new InvalidDeck("That list no longer exists");
  const deck: CustomDeck = {
    ...existing,
    ...validate(input),
    updatedAt: new Date().toISOString(),
  };
  await store.putDeck(deck);
  await all();
  return deck;
}

export async function remove(id: string): Promise<void> {
  await store.removeDeck(id);
  await all();
}

/* ── Sharing a list between families ─────────────────────────────────────
   A single deck as a file, distinct from a full backup: what gets passed
   round a class group is this week's spellings, not somebody's children's
   race history.                                                           */

export type DeckFile = {
  kind: "schoolskills-deck";
  version: 1;
  name: string;
  emoji: string;
  words: string[];
};

export const toFile = (deck: CustomDeck): DeckFile => ({
  kind: "schoolskills-deck",
  version: 1,
  name: deck.name,
  emoji: deck.emoji,
  words: deck.words,
});

/**
 * Reads a shared list into the same input a typed-in one produces.
 *
 * Deliberately does NOT write. Every deck in the app is created through one
 * path — `HubContext.saveDeck` — so the on-screen list can't get out of step
 * with storage; an import that wrote directly here would land in IndexedDB and
 * stay invisible until the next reload. (It did, once.)
 *
 * The sender's id is dropped on purpose. Two families' copies are separate
 * decks with separate records, and keeping the id would silently overwrite a
 * list of the same origin that the reader had since edited.
 */
export function readDeckFile(parsed: unknown): DeckInput {
  const file = parsed as Partial<DeckFile>;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    file.kind !== "schoolskills-deck" ||
    !Array.isArray(file.words)
  ) {
    throw new InvalidDeck("That doesn't look like a School Skills word list");
  }
  return validate({
    name: typeof file.name === "string" ? file.name : "Shared list",
    emoji: typeof file.emoji === "string" ? file.emoji : "✏️",
    words: file.words.filter((w): w is string => typeof w === "string"),
  });
}

/** True for a list this build ships, which can't be edited or deleted. */
export const isBuiltIn = (listId: string) => WORD_LISTS_BY_ID.has(listId);
