import { percent } from "@/engine/format";
import type { Session } from "@/engine/types";

/** The five numbers a player actually looks at first. */
export function Scoreline({
  session,
  accuracy,
}: {
  session: Session;
  accuracy: number;
}) {
  const perCard = session.durationMs / Math.max(1, session.cards.length) / 1000;
  return (
    <section className="scoreline panel anim-rise">
      <div className="stat">
        <span className="stat__value">{percent(accuracy)}</span>
        <span className="stat__label">Correct</span>
      </div>
      <div className="stat">
        <span className="stat__value">
          {session.correct}
          <span className="scoreline__of">
            /{session.correct + session.incorrect}
          </span>
        </span>
        <span className="stat__label">Cards</span>
      </div>
      <div className="stat">
        <span className="stat__value">{session.bestStreak}</span>
        <span className="stat__label">Best streak</span>
      </div>
      <div className="stat">
        <span className="stat__value">{perCard.toFixed(2)}s</span>
        <span className="stat__label">Per card</span>
      </div>
      <div className="stat stat--xp">
        <span className="stat__value">
          +{session.xpEarned.toLocaleString()}
        </span>
        <span className="stat__label">XP earned</span>
      </div>
    </section>
  );
}
