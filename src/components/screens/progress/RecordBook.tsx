import { Avatar } from "@/components/ui/kit";
import { describeConfig } from "@/engine/decks/flashcards";
import { raceTimeMs } from "@/engine/records";
import { clock, percent, shortDate } from "@/engine/format";
import type { Profile, Session } from "@/engine/types";

type Record_ = {
  key: string;
  myBest: Session;
  houseBest: Session;
  holder: Profile | undefined;
};

/**
 * Best times per race type, mine against the household's.
 *
 * The house column is the whole point of a shared device: a sibling's name
 * next to a time is the thing that makes a kid want another go. It only
 * compares runs at identical settings, which is what `record.key` guarantees.
 */
export function RecordBook({
  records,
  profileId,
}: {
  records: Record_[];
  profileId: string;
}) {
  return (
    <section className="panel anim-rise">
      <div className="panel__head">
        <h2 className="panel__title">Records</h2>
      </div>
      {records.length === 0 ? (
        <p className="muted">Race something and your best times land here.</p>
      ) : (
        <div className="splits__scroll">
          <table className="splits">
            <thead>
              <tr>
                <th scope="col">Race</th>
                <th scope="col">Your best</th>
                <th scope="col">House best</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const isMine = record.houseBest.profileId === profileId;
                return (
                  <tr key={record.key}>
                    <td className="splits__card">
                      {describeConfig(record.myBest.config)}
                    </td>
                    <td className="u-mono">
                      {clock(raceTimeMs(record.myBest))}
                    </td>
                    <td className="u-mono splits__holder">
                      {clock(raceTimeMs(record.houseBest))}
                      {record.holder && (
                        <span
                          className={`splits__who${isMine ? " is-ahead" : ""}`}
                        >
                          <Avatar profile={record.holder} size="1.1rem" />
                          {isMine ? "you" : record.holder.name}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** The last 40 runs, newest first. Older ones live in the record book above. */
export function RunList({ sessions }: { sessions: Session[] }) {
  return (
    <section className="panel anim-rise">
      <div className="panel__head">
        <h2 className="panel__title">Every race</h2>
      </div>
      {sessions.length === 0 ? (
        <p className="muted">No races yet.</p>
      ) : (
        <ul className="runlist">
          {[...sessions]
            .reverse()
            .slice(0, 40)
            .map((session) => (
              <li key={session.id} className="runlist__row">
                <span className="runlist__when u-mono">
                  {shortDate(session.finishedAt)}
                </span>
                <span className="runlist__what">
                  {describeConfig(session.config)}
                </span>
                <span className="runlist__acc u-mono">
                  {percent(
                    session.correct /
                      Math.max(1, session.correct + session.incorrect),
                  )}
                </span>
                <span className="runlist__time u-mono">
                  {clock(raceTimeMs(session))}
                </span>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
