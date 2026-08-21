/**
 * The beat before a storm falls (docs/typing.md §8.13, decision 71).
 *
 * ── Why a storm waits, where a race counts ───────────────────────────────────
 * Every other run on this site opens with the 3·2·1 (`useCountdown`), and the
 * reason that works there is that a race is entered with the hands already
 * where they are going to be: a flash card is answered on the number row or
 * with a tap, and a passage lesson puts the caret in an input a child has
 * clicked into. A storm is entered from a tile with a mouse, and then asks for
 * eight fingers on the home row and a reaction time — so a three-second count
 * is three seconds of a child moving one hand off a trackpad while the first
 * letter is already being scheduled.
 *
 * A clock cannot fix that, because the thing being waited for is not an amount
 * of time. It is a child being ready, which only they can know. So the storm
 * waits, indefinitely and with no counter running, for the one signal that
 * proves the hands are where they need to be: a key.
 *
 * ── Nothing is falling yet, and nothing is drawn ─────────────────────────────
 * The first letter of a wave spawns at time zero (`buildWave`), so a field
 * that merely held the clock still would be showing it — a free look at the
 * first target for as long as a child cared to take one, and the reading beat
 * `QUEUE_MS` gives every OTHER letter turned into an unlimited one for the
 * first. So the same prop that puts this panel in the sky is what takes the
 * stones out of it (`StormField`): the letters begin when the storm does.
 *
 * ── The bumps ────────────────────────────────────────────────────────────────
 * The two lines here are the only place on this screen a child is told how to
 * put their hands down, and the storm is the one screen in the epic with no
 * keyboard drawn on it (decision 64) — so it names the thing a keyboard has
 * instead of a picture: the ridges on `F` and `J`. That is the actual
 * technique for finding the home row without looking, which is the habit every
 * lesson below is trying to build, and it is a thing a five-year-old can do in
 * the two seconds they are reading it.
 *
 * ── It holds no listener ─────────────────────────────────────────────────────
 * "Press any key" is answered in `useStormClock`, beside the gun it becomes
 * (`started`). One window listener on this screen is the rule the whole file
 * is built on: while a run is live every stroke is a shot, so a second
 * listener is a press answered twice — and the press that starts a storm is
 * exactly the one that would otherwise be a miss on the way in.
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
