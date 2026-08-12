import { Button } from "@/components/ui/kit";
import {
  OPERATIONS,
  OPERATION_ORDER,
  type OperationSpec,
} from "@/engine/decks/flashcards";
import { factKey, masteryOf, type Mastery } from "@/engine/records";
import type { Operation } from "@/engine/types";

const AXIS = Array.from({ length: 12 }, (_, i) => i + 1);

export const MASTERY_LABEL: Record<Mastery, string> = {
  untried: "Not tried yet",
  learning: "Still learning",
  solid: "Getting there",
  mastered: "Mastered",
};

/**
 * Every fact from 1 to 12, coloured by how well it's known.
 *
 * A real <table> with header cells on both axes: a grid of 144 divs would be
 * unreadable to a screen reader, and each cell already carries its own
 * spoken-only summary. The operation switcher sits in the heading rather than
 * above the map because it changes what the map *is*, not how it's filtered.
 */
export function FactMap({
  operation,
  onOperationChange,
  spec,
  grid,
}: {
  operation: Operation;
  onOperationChange: (op: Operation) => void;
  spec: OperationSpec;
  /** Per-fact attempt stats, keyed by `factKey`. */
  grid: Map<string, { attempts: number; correct: number; totalMs: number }>;
}) {
  return (
    <section className="panel anim-rise">
      <div className="panel__head">
        <h2 className="panel__title">Fact map</h2>
        <div className="segmented segmented--slim">
          {OPERATION_ORDER.map((op) => (
            <Button
              key={op}
              variant="bare"
              className={`segmented__btn${operation === op ? " is-on" : ""}`}
              onClick={() => onOperationChange(op)}
              pressed={operation === op}
            >
              {OPERATIONS[op].symbol}
            </Button>
          ))}
        </div>
      </div>
      <p className="muted">
        Every {spec.label.toLowerCase()} fact from 1 to 12. A square turns green
        once it&apos;s answered right three times running and under four seconds
        — that&apos;s recall, not counting.
      </p>

      <div className="factmap__wrap">
        <table className="factmap">
          <caption className="u-sr">{spec.label} facts by mastery</caption>
          <thead>
            <tr>
              <th scope="col" className="factmap__corner u-mono">
                {spec.symbol}
              </th>
              {AXIS.map((n) => (
                <th key={n} scope="col" className="u-mono factmap__axis">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AXIS.map((row) => (
              <tr key={row}>
                <th scope="row" className="u-mono factmap__axis">
                  {row}
                </th>
                {AXIS.map((col) => {
                  const stat = grid.get(factKey(row, col));
                  const level = masteryOf(stat);
                  const avg = stat ? stat.totalMs / stat.attempts / 1000 : null;
                  return (
                    <td key={col} className={`factmap__cell is-${level}`}>
                      <span className="u-sr">
                        {row} {spec.symbol} {col}: {MASTERY_LABEL[level]}
                      </span>
                      <span className="factmap__tip" aria-hidden="true">
                        {row} {spec.symbol} {col}
                        {stat
                          ? ` · ${stat.correct}/${stat.attempts} · ${avg!.toFixed(1)}s`
                          : " · not tried"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="legend">
        {(["untried", "learning", "solid", "mastered"] as Mastery[]).map(
          (level) => (
            <li key={level} className="legend__item">
              <span
                className={`legend__swatch is-${level}`}
                aria-hidden="true"
              />
              {MASTERY_LABEL[level]}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
