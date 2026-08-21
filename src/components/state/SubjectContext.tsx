import { createContext, useContext, type ReactNode } from "react";

import { deckSpec, modeOf } from "@/engine/decks";
import { presetForAge } from "@/engine/decks/flashcards";
import { wordListForAge } from "@/engine/decks/wordlists";
import type { CardConfig } from "@/engine/types";
import type { World } from "@/engine/worlds";

/**
 * Which subject this mount of the card island is.
 *
 * One island, two front doors. `/flash-cards` is The Grid and `/spelling/play`
 * is Word Jungle, and a player entering one never sees the other's decks — a
 * child sent to practise spellings should not have to walk past a times-table
 * picker to get there.
 *
 * ── Why two routes rather than two apps ─────────────────────────────────────
 * The race loop, the ghost, the clock, XP, badges and the record book are the
 * same machine either way; only the deck differs, and that difference is
 * already expressed by `DeckSpec`. Forking the island would fork all of that
 * to change one picker.
 *
 * More importantly the two must stay on the SAME ORIGIN. Storage is scoped to
 * an origin, not a route, so `/spelling/play` and `/flash-cards` share one
 * IndexedDB and one profile list — which is the whole reason a child's level,
 * badges and record book follow them between subjects. Splitting by subdomain
 * would have partitioned that; splitting by path costs nothing.
 */
export type SubjectId = "numbers" | "words";

export type Subject = {
  id: SubjectId;
  /**
   * The world this app is played in — and, because a deck names its own world,
   * the test for which saved runs belong here.
   */
  world: World;
  /** How the hub introduces itself. */
  eyebrow: string;
  /** Two lines: the hub sets its title stacked. */
  title: [string, string];
  blurb: string;

  /** A starting deck for a player of this age, when they have no history here. */
  startingConfig(age: number): CardConfig;
};

export const SUBJECTS: Record<SubjectId, Subject> = {
  numbers: {
    id: "numbers",
    world: "grid",
    eyebrow: "The Grid · flash cards",
    title: ["Times", "Trial"],
    blurb:
      "Race a deck of multiplication cards against the clock — or against a ghost of your best run, or one of your siblings'.",
    startingConfig: (age) => presetForAge(age).config,
  },

  words: {
    id: "words",
    world: "jungle",
    eyebrow: "Word Jungle · spelling",
    title: ["Word", "Jungle"],
    blurb:
      "Hear a word and spell it from memory, against the clock — or against a ghost of your best run, or one of your siblings'.",
    // Borrows the age tuning the maths presets already do: how long a race is,
    // whether it's typed or tapped, and how tight the card clock starts. Only
    // what's ON the cards is different.
    startingConfig: (age) => {
      const { cardCount, inputMode, timeLimitMs } = presetForAge(age).config;
      return {
        kind: "words",
        listId: wordListForAge(age).id,
        cardCount,
        inputMode,
        timeLimitMs: timeLimitMs ?? null,
      };
    },
  },
};

export const ownsMode = (subject: Subject, mode: string) =>
  deckSpec(mode).world === subject.world;

/**
 * The deck this app opens on: the last one the player actually raced here,
 * falling back to the starting deck for their age. Coming back to spelling
 * should land on the list they were working through, not on list one.
 */
export function homeMode(
  subject: Subject,
  modesPlayed: string[],
  age: number,
): string {
  for (let i = modesPlayed.length - 1; i >= 0; i--) {
    if (ownsMode(subject, modesPlayed[i])) return modesPlayed[i];
  }
  return modeOf(subject.startingConfig(age));
}

const SubjectContext = createContext<Subject | null>(null);

export function SubjectProvider({
  subject,
  children,
}: {
  subject: Subject;
  children: ReactNode;
}) {
  return (
    <SubjectContext.Provider value={subject}>
      {children}
    </SubjectContext.Provider>
  );
}

export function useSubject(): Subject {
  const value = useContext(SubjectContext);
  if (!value)
    throw new Error("useSubject must be used inside <SubjectProvider>");
  return value;
}
