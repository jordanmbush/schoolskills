import type { Profile, Session } from "@/engine/types";

import { deckSpec } from "@/engine/decks";
import { sessionsFor, troubleFacts } from "@/engine/records";

import { loadHub } from "./hub";

/**
 * What the record book already knows a child keeps getting wrong.
 *
 * The one door between a child's history and The Print Shop, and the reason
 * there is a service here at all: the bench is a `client:only` island with no
 * hub around it, and a view that read the sessions itself would be reaching
 * past the layer that owns the schema — the boundary `eslint.config.mjs`
 * enforces. So the island asks for this and gets plain data back.
 *
 * **Nothing here leaves the device, and nothing here becomes a sheet.** What
 * comes out is a list of fact ids in the deck's own vocabulary
 * (`DeckSpec.drillKey`) plus the words to show them in; turning those into
 * paper is `engine/sheets/practice.ts`, which never learns whose facts they
 * were. A child's name is on this side of that line and stays here — the sheet
 * it produces travels in a URL (docs/printables.md §14), and a name in one
 * would be the one thing this site refuses to hold.
 *
 * Nothing is computed here that the record book does not already compute. The
 * ranking, the folding of two cards onto one fact and the phrase a fact is
 * named by are all `records.ts` and `DeckSpec`, so a sheet of trouble facts
 * and a drill of them are the same list — printed, or raced.
 */

/** The facts a player keeps missing in one deck, worst first. */
export type PracticeSet = {
  /** `Session.mode` — the deck, and what `deckSpec` routes on. */
  mode: string;
  /** What that deck is called: "Multiplication", "Year 2 spellings". */
  label: string;
  /** The deck's own drill keys, in the order the record book ranked them. */
  facts: string[];
  /** The same facts as they read on screen — "7 × 8", or just the word. */
  labels: string[];
};

/** One player, and every deck they have trouble in. */
export type PracticePlayer = {
  id: string;
  name: string;
  /**
   * Worst deck first, and empty for a player with nothing standing out —
   * which is not an error and not a reason to leave them out of the picker. A
   * child who has never raced is the commonest case on a shared family
   * machine, and the honest answer is a sheet of the whole table rather than
   * a screen that says no.
   */
  sets: PracticeSet[];
};

/**
 * The same computation as the progress screen's trouble panel, per deck.
 *
 * Pure, and exported for that reason: everything below it needs IndexedDB, and
 * the judgement worth testing is which facts come out and in what order.
 */
export function practiceFrom(
  profiles: Profile[],
  sessions: Session[],
): PracticePlayer[] {
  return profiles.map((profile) => {
    const mine = sessionsFor(sessions, profile.id);
    // Only the decks this player has actually raced. A switcher offering every
    // deck ever shipped would bury the one they have been struggling with.
    const modes = [...new Set(mine.map((session) => session.mode))].sort();

    const sets = modes
      .map((mode) => {
        // No `take`: the same eight the progress screen shows, so "drill these"
        // and "print these" are the same list rather than two lists that
        // happen to start the same way.
        const trouble = troubleFacts(mine, mode);
        const spec = deckSpec(mode);
        return {
          mode,
          label: spec.label,
          facts: trouble.map((fact) => fact.factId),
          labels: trouble.map((fact) => spec.factLabel(fact.factId)),
          // Not part of the set — only what orders them below. The worst deck
          // is the one with the worst fact in it, which is the one a parent
          // standing at the printer means.
          worst: trouble[0]?.score ?? 0,
        };
      })
      .filter((set) => set.facts.length > 0)
      .sort((a, b) => b.worst - a.worst)
      .map(({ mode, label, facts, labels }) => ({
        mode,
        label,
        facts,
        labels,
      }));

    return { id: profile.id, name: profile.name, sets };
  });
}

/**
 * Every player on this device, and what each of them keeps missing.
 *
 * Through `loadHub` rather than the store, for the reason the hub's own note
 * gives: loading is also what mirrors a parent's word lists into the engine,
 * and without that a spelling deck would come back named "Words" and its facts
 * would be a list this build could not turn into a sheet.
 */
export async function loadPractice(): Promise<PracticePlayer[]> {
  const { profiles, sessions } = await loadHub();
  return practiceFrom(profiles, sessions);
}
