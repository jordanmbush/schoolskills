import type { ReactNode } from "react";
import { masteryOf, type FactStat } from "@/engine/records";
import { MASTERY_LABEL, MasteryLegend } from "./MasteryLegend";

/**
 * The word list, coloured by how well each word is known.
 *
 * The times-table map's counterpart. A grid makes no sense here — words have
 * no two axes — so it's the list itself, in the order the list is taught,
 * which is also roughly the order of difficulty. Seeing the words you haven't
 * met yet sitting greyed out beside the ones you've mastered is most of the
 * point.
 *
 * When the list has been deleted, the words a player actually raced are all
 * that's left of it, and those come from the stats themselves.
 */
export function WordMap({
  label,
  words,
  grid,
  switcher,
}: {
  label: string;
  /** The full list, or what's recoverable from history if it's gone. */
  words: string[];
  /** Per-word attempt stats, keyed by the deck's `masteryKey`. */
  grid: Map<string, FactStat>;
  switcher: ReactNode;
}) {
  const known = words.filter(
    (word) => masteryOf(grid.get(word)) === "mastered",
  ).length;

  return (
    <section className="panel anim-rise">
      <div className="panel__head">
        <h2 className="panel__title">Word map</h2>
        {switcher}
      </div>
      <p className="muted">
        {label} — {known} of {words.length} mastered. A word turns green once
        it&apos;s spelt right three times running and under four seconds.
      </p>

      <ul className="wordmap">
        {words.map((word) => {
          const stat = grid.get(word);
          const level = masteryOf(stat);
          const avg = stat ? stat.totalMs / stat.attempts / 1000 : null;
          return (
            <li key={word} className={`wordmap__word is-${level}`}>
              <span aria-hidden="true">{word}</span>
              <span className="u-sr">
                {word}: {MASTERY_LABEL[level]}
              </span>
              <span className="wordmap__tip" aria-hidden="true">
                {stat
                  ? `${stat.correct}/${stat.attempts} · ${avg!.toFixed(1)}s`
                  : "not tried"}
              </span>
            </li>
          );
        })}
      </ul>

      <MasteryLegend />
    </section>
  );
}
