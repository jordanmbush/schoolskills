import type { Hold } from "@/engine/typing/hands";
import type { Lesson } from "@/engine/typing/lessons";

/** How long the key has to be down, unbroken, before the run begins (§5.8). */
export const HOLD_TO_BEGIN_MS = 1000;

/**
 * The screen a held-key lesson opens on (§5.8, decision 77): what to hold,
 * with which finger, and what that leaves — and nothing starts until the key
 * has been down for a second.
 *
 * A storm waits for a key because readiness is not an amount of time (§8.13);
 * this waits for a *held* key for the same reason, and the second is not a
 * countdown but the proof that the hand has settled rather than passed
 * through. The meter fills over exactly `HOLD_TO_BEGIN_MS` — handed to the
 * stylesheet as `--hold-ms`, so the picture and the timer cannot drift — and
 * is keyed on the hold, so a release and a fresh press start it from empty.
 *
 * It holds no listener: `useHeldKey` says whether the key is down and
 * `useHeldFor` when it has been down long enough, both in `TypingTrack`.
 */
export function HoldReady({
  lesson,
  hold,
  held,
}: {
  lesson: Lesson;
  hold: Hold;
  held: boolean;
}) {
  return (
    <div
      className="countdown hold"
      style={{ "--hold-ms": `${HOLD_TO_BEGIN_MS}ms` } as React.CSSProperties}
    >
      <p className="hold__eyebrow">
        Lesson {lesson.n} · {lesson.title}
      </p>
      <h2 className="hold__head">
        Hold <kbd className="hold__key u-mono">{hold.key}</kbd> down with your{" "}
        {hold.finger}
      </h2>
      <p className="hold__note">
        Keep it held for the whole lesson and type with your {hold.free} hand.
        Let go and the words wait until you hold it again.
      </p>
      <div className="hold__meter" aria-hidden="true">
        <span
          key={held ? "down" : "up"}
          className="hold__fill"
          data-held={held || undefined}
        />
      </div>
      <p className="hold__go" aria-live="polite">
        {held ? "Keep holding…" : "Hold it for a second to begin"}
      </p>
    </div>
  );
}
