import type { DeckSpec } from "@/engine/decks";
import { practiceHref } from "@/engine/sheets/practice";
import type { SheetConfig } from "@/engine/sheets/types";
import type { TroubleFact } from "@/engine/records";
import type { WorldInfo } from "@/engine/worlds";
import { Button } from "@/components/ui/kit";

/**
 * The facts worth practising, and the two things to do about them.
 *
 * The list itself is `troubleFacts` — ranked worst-first, and a fact drops off
 * it as it gets learned — so this panel adds no judgement of its own. What it
 * adds is the pair of doors: **the same list, either raced or printed**
 * (docs/printables.md §14). A drill is a short deck of exactly these facts; a
 * sheet is exactly these facts on paper, which is the one thing no other
 * worksheet site can print because no other worksheet site knows what the
 * child got wrong.
 *
 * Split out of `Progress.tsx` when the second door was added, which is the
 * right seam either way: the panel is one idea, and the screen around it is a
 * record book.
 */
export function TroubleSpots({
  trouble,
  spec,
  drill,
  elsewhere,
  printable,
}: {
  trouble: TroubleFact[];
  /** The deck these facts belong to — how they are named, and what it is called. */
  spec: DeckSpec;
  /** Race them. Null when the deck belongs to another world; see `elsewhere`. */
  drill: (() => void) | null;
  /**
   * Where that deck does live. The record book spans every world, but a drill
   * can only start where the deck is played and handing a built config across
   * a page load would need somewhere to put it — so this is a link, and the
   * facts are listed underneath either way.
   */
  elsewhere?: WorldInfo;
  /**
   * The same facts as a worksheet, or null where this build has no sheet for
   * them — a typing passage is not a page of problems.
   */
  printable: SheetConfig | null;
}) {
  return (
    <section className="panel anim-rise">
      <div className="panel__head">
        <h2 className="panel__title">Trouble spots</h2>
        {trouble.length > 0 && (
          <span className="panel__actions">
            {drill ? (
              <Button variant="accent" size="sm" onClick={drill}>
                Drill these
              </Button>
            ) : (
              <a
                className="btn btn--accent btn--sm"
                href={elsewhere?.href ?? "/"}
              >
                Open {elsewhere?.name ?? "the map"}
              </a>
            )}
            {/* A link and not a handover, for the same reason the one beside it
                is: a sheet's config *is* its id (§14), so the bench opens on
                exactly these facts with nothing stored between the two pages —
                and nothing about the child in the link either. */}
            {printable && (
              <a
                className="btn btn--ghost btn--sm"
                href={practiceHref(printable)}
              >
                Print these
              </a>
            )}
          </span>
        )}
      </div>
      {trouble.length === 0 ? (
        <p className="muted">
          Nothing standing out in {spec.label.toLowerCase()}. Facts land here
          when the clock beats them, when they come out wrong, or when they take
          longer than recall should.
        </p>
      ) : (
        <>
          <p className="muted">
            Worst first. Answering one quickly and correctly takes it back off
            the list.
          </p>
          <ul className="trouble">
            {trouble.map((fact) => (
              <li key={fact.factId} className="trouble__item">
                <span className="trouble__fact u-mono">
                  {spec.factLabel(fact.factId)}
                </span>
                <span className="trouble__why">
                  {fact.timeouts > 0 && (
                    <span className="chip chip--late">
                      ⏳ {fact.timeouts} out of time
                    </span>
                  )}
                  {fact.wrong > 0 && (
                    <span className="chip chip--wrong">
                      ✕ {fact.wrong} wrong
                    </span>
                  )}
                  {fact.slow > 0 && (
                    <span className="chip">🐢 {fact.slow} slow</span>
                  )}
                </span>
                <span className="trouble__avg u-mono">
                  {(fact.avgMs / 1000).toFixed(1)}s
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
