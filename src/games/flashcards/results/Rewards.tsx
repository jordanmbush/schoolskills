import { BADGES_BY_ID } from "@/engine/progress";

/**
 * What the run earned beyond the score: a level, XP bonuses, new badges.
 *
 * Renders nothing at all when there's nothing to celebrate — an empty rewards
 * strip on an ordinary run would make every ordinary run feel like a miss.
 */
export function Rewards({
  levelledUpTo,
  bonuses,
  newBadges,
}: {
  levelledUpTo: number | null;
  bonuses: Array<{ label: string; xp: number }>;
  newBadges: string[];
}) {
  if (!levelledUpTo && bonuses.length === 0 && newBadges.length === 0) {
    return null;
  }
  return (
    <section className="rewards anim-rise">
      {levelledUpTo && (
        <div className="reward reward--level">
          <span className="reward__icon" aria-hidden="true">
            🌟
          </span>
          <span>
            <strong>Level {levelledUpTo}</strong>
            <span className="reward__sub">You levelled up</span>
          </span>
        </div>
      )}
      {bonuses.map((bonus) => (
        <div key={bonus.label} className="reward">
          <span className="reward__icon" aria-hidden="true">
            ⚡
          </span>
          <span>
            <strong>{bonus.label}</strong>
            <span className="reward__sub">+{bonus.xp} XP</span>
          </span>
        </div>
      ))}
      {newBadges.map((id) => {
        const badge = BADGES_BY_ID.get(id);
        if (!badge) return null;
        return (
          <div key={id} className="reward reward--badge">
            <span className="reward__icon" aria-hidden="true">
              {badge.icon}
            </span>
            <span>
              <strong>{badge.name}</strong>
              <span className="reward__sub">{badge.how}</span>
            </span>
          </div>
        );
      })}
    </section>
  );
}
