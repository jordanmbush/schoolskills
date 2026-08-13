import { Button } from "@/components/ui/kit";
import { OPERATIONS, OPERATION_ORDER } from "@/engine/decks/flashcards";
import { buildDeck } from "@/engine/decks";
import { sfx } from "@/services/sound";
import { DeckPicker } from "./DeckPicker";
import type { FlashConfig, Operation } from "@/engine/types";

const TABLE_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);

const ascending = (list: number[]) => [...list].sort((a, b) => a - b);

/**
 * Which sums end up on the cards: the operation, and the two number grids.
 *
 * Lifted out of RaceSetup when spelling arrived — that screen now picks a
 * subject first and mounts this or `WordSettings`, and neither has to know
 * the other exists.
 */
export function MathsSettings({
  config,
  onChange,
}: {
  config: FlashConfig;
  onChange: (next: FlashConfig) => void;
}) {
  const spec = OPERATIONS[config.operation];
  const patch = (next: Partial<FlashConfig>) =>
    onChange({ ...config, ...next });

  const otherNumbers = Array.from(
    { length: 13 - spec.minOther },
    (_, i) => i + spec.minOther,
  );
  // Three real cards from the current settings, so the effect of a tick is
  // visible without starting a race.
  const sample = buildDeck(config, 7)
    .slice(0, 3)
    .map((card) => card.prompt);

  /**
   * Unticking a table also drops that number from the right-hand grid, so
   * "I unticked 12" means no 12 appears on any card — which is what the grid
   * looks like it promises.
   */
  function toggleTable(n: number) {
    sfx.tap();
    if (!config.tables.includes(n)) {
      patch({ tables: ascending([...config.tables, n]) });
      return;
    }
    const tables = config.tables.filter((t) => t !== n);
    if (tables.length === 0) return;
    const others = config.others.filter((o) => o !== n);
    patch({ tables, others: others.length === 0 ? config.others : others });
  }

  function toggleOther(n: number) {
    sfx.tap();
    const others = config.others.includes(n)
      ? config.others.filter((o) => o !== n)
      : [...config.others, n];
    if (others.length === 0) return;
    patch({ others: ascending(others) });
  }

  return (
    <>
      <div className="control">
        <span className="control__label">Operation</span>
        <div className="segmented">
          {OPERATION_ORDER.map((op) => (
            <Button
              key={op}
              variant="bare"
              className={`segmented__btn${config.operation === op ? " is-on" : ""}`}
              onClick={() => {
                sfx.tap();
                // Division can't pair with 0, so drop it when switching.
                const next = OPERATIONS[op as Operation];
                patch({
                  operation: op,
                  others: config.others.filter((n) => n >= next.minOther),
                });
              }}
              pressed={config.operation === op}
            >
              <span aria-hidden="true">{OPERATIONS[op].symbol}</span>
              <span className="segmented__word">{OPERATIONS[op].label}</span>
            </Button>
          ))}
        </div>
      </div>

      <DeckPicker
        config={config}
        spec={spec}
        focusNumbers={TABLE_NUMBERS}
        pairNumbers={otherNumbers}
        sample={sample}
        onToggleFocus={toggleTable}
        onTogglePair={toggleOther}
        patch={patch}
        tap={sfx.tap}
      />
    </>
  );
}
