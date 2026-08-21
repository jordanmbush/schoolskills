/**
 * The beat before a storm falls (docs/typing.md §8.13, decision 71).
 *
 * A storm waits for a key rather than counting down, because readiness is not
 * an amount of time (§8.13). The two lines are the only place this game says
 * how to put hands down, and with no keyboard drawn (decision 64) they name
 * what a real one has: the ridges on `F` and `J`.
 *
 * **It holds no listener.** "Press any key" is answered in `useStormClock`,
 * beside the gun it becomes (`started`): while a run is live every stroke is a
 * shot, so a second listener is a press answered twice — and the press that
 * starts a storm is exactly the one that would otherwise be a miss on the way
 * in.
 */
export function StormReady() {
  return (
    <div className="storm__ready">
      <p className="storm__ready-head">Get ready</p>
      <p className="storm__ready-note">
        Find the two little bumps — <b>F</b> and <b>J</b> — and rest your
        fingers on the home row.
      </p>
      <p className="storm__ready-go">Press any key to start</p>
    </div>
  );
}
