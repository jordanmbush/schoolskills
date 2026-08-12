import { Avatar } from "@/components/ui/kit";
import { delta as formatDelta } from "@/engine/format";
import type { Ghost, Session } from "@/engine/types";

/**
 * Card-by-card, with the rival's time alongside when there was one.
 *
 * A real <table> rather than a grid of divs: this is tabular data, the header
 * row is what makes the rival and gap columns legible, and it's the one part
 * of the results screen a parent is likely to read across.
 */
export function SplitsTable({
  session,
  ghost,
  mySplits,
  ghostSplits,
}: {
  session: Session;
  ghost: Ghost | null;
  /** Cumulative finish times, used only to compute the running gap. */
  mySplits: number[];
  ghostSplits: number[] | null;
}) {
  return (
    <section className="panel anim-rise">
      <div className="panel__head">
        <h2 className="panel__title">Splits</h2>
        {ghost && (
          <span className="chip">
            <Avatar profile={ghost.profile} size="1.2rem" />
            {ghost.isSelf ? "Your best run" : ghost.profile.name}
          </span>
        )}
      </div>
      <div className="splits__scroll">
        <table className="splits">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Card</th>
              <th scope="col">You</th>
              {ghostSplits && <th scope="col">Rival</th>}
              {ghostSplits && <th scope="col">Gap</th>}
            </tr>
          </thead>
          <tbody>
            {session.cards.map((card, i) => {
              const gap =
                ghostSplits && ghostSplits[i] !== undefined
                  ? mySplits[i] - ghostSplits[i]
                  : null;
              const rivalCard = ghost?.session.cards[i];
              return (
                <tr
                  key={i}
                  className={
                    card.ok
                      ? undefined
                      : card.timedOut
                        ? "splits__row--late"
                        : "splits__row--miss"
                  }
                >
                  <td className="u-mono splits__n">{i + 1}</td>
                  <td className="splits__card">
                    {card.prompt} = {card.answer}
                    {!card.ok && (
                      <span
                        className={`splits__given${card.timedOut ? " is-late" : ""}`}
                      >
                        {card.timedOut
                          ? "ran out of time"
                          : `you said ${card.given}`}
                      </span>
                    )}
                  </td>
                  <td className="u-mono">{(card.ms / 1000).toFixed(2)}</td>
                  {ghostSplits && (
                    <td className="u-mono splits__rival">
                      {rivalCard ? (rivalCard.ms / 1000).toFixed(2) : "—"}
                    </td>
                  )}
                  {ghostSplits && (
                    <td
                      className={`u-mono splits__gap${gap !== null && gap < 0 ? " is-ahead" : " is-behind"}`}
                    >
                      {gap === null ? "—" : formatDelta(gap)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
