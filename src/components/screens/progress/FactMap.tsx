import type { ReactNode } from "react";
import type { OperationSpec } from "@/engine/decks/flashcards";
import { factKey, masteryOf } from "@/engine/records";
import { MASTERY_LABEL, MasteryLegend } from "./MasteryLegend";

const AXIS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Every fact from 1 to 12, coloured by how well it's known.
 *
 * A real <table> with header cells on both axes: a grid of 144 divs would be
 * unreadable to a screen reader, and each cell already carries its own
 * spoken-only summary. Pick a word list in the heading's switcher and
 * `WordMap` renders in this one's place (`DeckSwitch`).
 */
export function FactMap({
  spec,
  grid,
  switcher,
}: {
  spec: OperationSpec;
  /** Per-fact attempt stats, keyed by `factKey`. */
  grid: Map<string, { attempts: number; correct: number; totalMs: number }>;
  switcher: ReactNode;
}) {
  return (
    <section className="panel anim-rise">
      <div className="panel__head">
        <h2 className="panel__title">Fact map</h2>
        {switcher}
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

      <MasteryLegend />
    </section>
  );
}
