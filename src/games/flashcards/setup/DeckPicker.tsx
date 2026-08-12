import { Button } from "@/components/ui/kit";
import {
  arithmeticFactId,
  type OperationSpec,
} from "@/engine/decks/flashcards";
import type { FlashConfig } from "@/engine/types";

/**
 * Which numbers end up on the cards.
 *
 * Two grids, and the promise the layout makes is that a card only ever uses a
 * number lit on BOTH sides — so unticking 12 on the left has to remove it from
 * the right too, or the grid is lying. That rule lives in `onToggleFocus`,
 * with the state it has to mutate.
 *
 * A drill arrives with its facts already chosen, so it replaces the grids
 * entirely rather than trying to render as a selection.
 */
export function DeckPicker({
  config,
  spec,
  focusNumbers,
  pairNumbers,
  sample,
  onToggleFocus,
  onTogglePair,
  patch,
  tap,
}: {
  config: FlashConfig;
  spec: OperationSpec;
  focusNumbers: number[];
  pairNumbers: number[];
  /** Three real cards from the current settings, so a tick shows its effect. */
  sample: string[];
  onToggleFocus: (n: number) => void;
  onTogglePair: (n: number) => void;
  patch: (next: Partial<FlashConfig>) => void;
  tap: () => void;
}) {
  const drill = config.facts?.length ? config.facts : null;

  if (drill) {
    return (
      <div className="control">
        <span className="control__label">Practice set</span>
        <p className="drill__lead">
          The {drill.length} facts you&apos;ve been missing most. Answer each
          one twice.
        </p>
        <ul className="factchips">
          {drill.map(([a, b]) => (
            <li key={`${a}:${b}`} className="factchip u-mono">
              {spec.factLabel(arithmeticFactId(a, b))}
            </li>
          ))}
        </ul>
        <div className="control__row">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              tap();
              patch({ facts: undefined });
            }}
          >
            Pick numbers instead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="control">
      <div className="numbers">
        <div className="numbers__side">
          <span className="control__label">{spec.focusLabel}</span>
          <div className="tablegrid">
            {focusNumbers.map((n) => (
              <Button
                key={n}
                variant="bare"
                className={`tablegrid__cell u-mono${config.tables.includes(n) ? " is-on" : ""}`}
                onClick={() => onToggleFocus(n)}
                pressed={config.tables.includes(n)}
              >
                {n}
              </Button>
            ))}
          </div>
          <div className="control__row">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patch({ tables: focusNumbers })}
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patch({ tables: [2, 5, 10] })}
            >
              Easy three
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patch({ tables: [6, 7, 8, 9] })}
            >
              Tricky four
            </Button>
          </div>
        </div>

        <div className="numbers__side">
          <span className="control__label">{spec.pairLabel}</span>
          <div className="tablegrid">
            {pairNumbers.map((n) => (
              <Button
                key={n}
                variant="bare"
                className={`tablegrid__cell u-mono${config.others.includes(n) ? " is-on" : ""}`}
                onClick={() => onTogglePair(n)}
                pressed={config.others.includes(n)}
              >
                {n}
              </Button>
            ))}
          </div>
          <div className="control__row">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patch({ others: pairNumbers })}
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patch({ others: [...config.tables] })}
            >
              Match tables
            </Button>
          </div>
        </div>
      </div>
      <p className="numbers__note">
        Cards only ever use numbers lit up on both sides. Unticking a number on
        the left removes it from the right too.
      </p>
      <p className="numbers__preview u-mono">e.g. {sample.join(" · ")}</p>
    </div>
  );
}
