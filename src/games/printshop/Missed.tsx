/**
 * Practice what they missed — the first of §14's three bootstraps. Everything it
 * needs is already computed, so this door only asks whose.
 *
 * One door on two shelves. The record book holds missed sums and missed
 * spellings alike, and each makes a sheet on a different shelf, so the door
 * shows only the sets that land on the shelf it is on: a child's spellings are
 * offered under Spelling, not under the times tables.
 *
 * **Nothing about a child goes any further than this component.** The picker
 * knows their name because it has to say it; what it hands the bench is a config
 * carrying facts and paper and nothing else, and that is what ends up in the
 * address bar.
 *
 * A player with no history is the normal case on a family machine, not an error
 * state, so there is always something to print: the ordinary sheet for the deck
 * they would have started on.
 */
import { useEffect, useState } from "react";

import { Button, Field, Select } from "@/components/ui/kit";
import { WORD_LISTS } from "@/engine/decks/wordlists";
import { wordMode } from "@/engine/decks/words";
import { PRACTICE_SEED, practiceSheet } from "@/engine/sheets/practice";
import type { SheetConfig } from "@/engine/sheets/types";
import { loadPractice, type PracticePlayer } from "@/services/practice";

import { shelfOf } from "./shelves";

/**
 * What a child with nothing in the record book gets, per shelf: the twelve
 * tables, where the site itself starts (`WORLDS[0]`), or the first sight-word
 * list, where the jungle does.
 */
const FRESH: Partial<
  Record<string, { mode: string; label: string; note: string }>
> = {
  maths: {
    mode: "multiply",
    label: "A mixed times-table sheet",
    note: "A mixed sheet of the tables is a good place to start.",
  },
  words: {
    mode: wordMode(WORD_LISTS[0].id),
    label: "The first sight words",
    note: "The first sight words are a good place to start.",
  },
};

export function Missed({
  shelf,
  onOpen,
}: {
  /** The shelf this door is on, by its id in `shelves.ts`. */
  shelf: string;
  onOpen: (config: SheetConfig, seed: number) => void;
}) {
  const [players, setPlayers] = useState<PracticePlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState("");
  const [deck, setDeck] = useState("");

  useEffect(() => {
    let live = true;
    loadPractice()
      .then((loaded) => live && setPlayers(loaded))
      .catch(() => {
        // A browser blocking storage — private browsing does — is the usual
        // cause, and it is worth saying: an empty picker otherwise reads as
        // "this family has never played", which is a different thing.
        if (live)
          setError("This browser isn't letting the site read anything.");
      });
    return () => {
      live = false;
    };
  }, []);

  // Derived rather than stored, so the pickers are right on the first paint
  // instead of a tick after the load.
  const player = players.find((p) => p.id === who) ?? players[0];
  // Only the decks this build can print, and only those whose sheet is on
  // this shelf. A typing level has trouble facts and no sheet family — a
  // passage is not a set of problems — so it is left out rather than offered
  // as a button that does nothing.
  const sets = (player?.sets ?? []).filter((set) => {
    const config = practiceSheet(set.mode, set.facts);
    return config !== null && shelfOf(config.kind).id === shelf;
  });
  const set = sets.find((s) => s.mode === deck) ?? sets[0];
  const fresh = FRESH[shelf];

  const open = (mode: string, facts: string[]) => {
    const config = practiceSheet(mode, facts);
    // Never null for either caller — both modes come from a set this build can
    // print, or from `FRESH` — and checked anyway, because the one thing worse
    // than no sheet is a blank one.
    if (config) onOpen(config, PRACTICE_SEED);
  };

  return (
    <div className="door">
      <h3 className="door__name">Practice what they missed</h3>
      {error && <p className="door__note">{error}</p>}

      {players.length > 0 && (
        <Field label="Whose">
          <Select
            value={player?.id ?? ""}
            onChange={setWho}
            options={players.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>
      )}

      {sets.length > 1 && (
        <Field label="Which practice">
          <Select
            value={set?.mode ?? ""}
            onChange={setDeck}
            options={sets.map((s) => ({
              value: s.mode,
              label: `${s.label} — ${s.facts.length}`,
            }))}
          />
        </Field>
      )}

      {set ? (
        <>
          <p className="door__facts">
            {set.labels.map((label) => (
              <span className="chip u-mono" key={label}>
                {label}
              </span>
            ))}
          </p>
          <Button
            variant="go"
            size="sm"
            onClick={() => open(set.mode, set.facts)}
          >
            Print these {set.facts.length}
          </Button>
        </>
      ) : (
        <>
          <p className="door__note">
            {players.length === 0
              ? "Nobody has raced on this device yet."
              : `Nothing standing out for ${player?.name} yet — facts land here when the clock beats them, when they come out wrong, or when they take longer than recall should.`}
            {fresh && ` ${fresh.note}`}
          </p>
          {fresh && (
            <Button
              variant="accent"
              size="sm"
              onClick={() => open(fresh.mode, [])}
            >
              {fresh.label}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
