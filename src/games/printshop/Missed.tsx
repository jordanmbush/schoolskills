/**
 * Practise what they missed — the first of §14's three bootstraps, and the one
 * the whole section exists for.
 *
 * No other worksheet site can print this page, because no other worksheet site
 * knows what the child got wrong. Everything it needs is already computed: the
 * record book ranks the trouble facts, `services/practice.ts` reads them
 * through the layer that owns the schema, and `practiceSheet` turns a deck and
 * a list of fact ids into paper. This screen only asks whose.
 *
 * **Nothing about a child goes any further than this component.** The picker
 * knows their name because it has to say it; what it hands the bench is a sheet
 * config, which carries facts and paper and nothing else — and that is what
 * ends up in the address bar (§14).
 *
 * A player with no history is the normal case on a family machine, not an
 * error state, so there is always something to print: the ordinary sheet for
 * the deck they would have started on.
 */
import { useEffect, useState } from "react";

import { Button, Field, Select } from "@/components/ui/kit";
import { PRACTICE_SEED, practiceSheet } from "@/engine/sheets/practice";
import type { SheetConfig } from "@/engine/sheets/types";
import { loadPractice, type PracticePlayer } from "@/services/practice";

/**
 * What a child with nothing in the record book gets: the twelve tables, which
 * is where the site itself starts (`WORLDS[0]`) and the sheet a parent who
 * pressed this button was most likely after anyway.
 */
const FIRST_DECK = "multiply";

export function Missed({
  onOpen,
}: {
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

  // Whoever is chosen, or the first player on the device. Derived rather than
  // stored, so the pickers are right on the first paint instead of a tick after
  // the load — there is no state here that the data does not already decide.
  const player = players.find((p) => p.id === who) ?? players[0];
  // Only the decks this build can actually print. A typing level has trouble
  // facts and no sheet family — a passage is not a set of problems — so it is
  // left out rather than offered as a button that does nothing.
  const sets = (player?.sets ?? []).filter(
    (set) => practiceSheet(set.mode, set.facts) !== null,
  );
  const set = sets.find((s) => s.mode === deck) ?? sets[0];

  const open = (mode: string, facts: string[]) => {
    const config = practiceSheet(mode, facts);
    // Never null for either caller — both modes come from a set this build can
    // print, or from the fallback deck — and checked anyway, because the one
    // thing worse than no sheet is a blank one.
    if (config) onOpen(config, PRACTICE_SEED);
  };

  return (
    <div className="bootstrap__step">
      <h3 className="bootstrap__name">Practise what they missed</h3>
      {error && <p className="bootstrap__note">{error}</p>}

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
          <p className="bootstrap__facts">
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
          <p className="bootstrap__note">
            {players.length === 0
              ? "Nobody has raced on this device yet."
              : `Nothing standing out for ${player?.name} yet — facts land here when the clock beats them, when they come out wrong, or when they take longer than recall should.`}{" "}
            A mixed sheet of the tables is a good place to start.
          </p>
          <Button
            variant="accent"
            size="sm"
            onClick={() => open(FIRST_DECK, [])}
          >
            A mixed times-table sheet
          </Button>
        </>
      )}
    </div>
  );
}
