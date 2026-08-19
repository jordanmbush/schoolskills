import { useNavigate } from "react-router-dom";

import { useRace } from "@/components/state/RaceContext";
import { Button } from "@/components/ui/kit";
import { buildDrill } from "@/engine/decks";
import { plural } from "@/engine/format";
import { FINGER_NAMES } from "@/engine/keyboard";
import { stormXp } from "@/engine/progress";
import { randomSeed } from "@/engine/random";
import { stormReport } from "@/engine/typing/storm";
import { sfx } from "@/services/sound";

import type { StormState } from "@/engine/typing/storm";

/**
 * What a storm came to, and what to do about it (docs/typing.md §8.5, §8.7).
 *
 * ── Which finger let it through ──────────────────────────────────────────────
 * This is the screen the whole epic is for. A child who has just lost is told
 * *whose fault it was on their own hand* — "your right ring finger let three
 * through" — and handed a drill of exactly the keys behind that finger. No
 * accuracy percentage can say that, and it is a thing a five-year-old can act
 * on within a second of reading it: they can look down at the finger.
 *
 * ── It decides nothing ───────────────────────────────────────────────────────
 * Every number here is `stormReport(state)`, computed in the engine beside the
 * rules that produced it — which finger, how many it let through, which keys
 * that finger owns, how much armour is left, the longest streak. This file
 * chooses words and puts them in boxes. That is the same division the loop
 * keeps (§8.9), and it is what makes "your right ring finger let three
 * through" a claim a unit test can hold still without a browser.
 *
 * XP is the one figure not in the report, because it cannot be: `stormXp`
 * lives in `progress.ts`, which reaches `decks/index.ts`, and `storm.ts` is
 * one hop from the deck layer from STM10 on. It is read here instead, where
 * the deck layer is already in the graph — this screen builds a drill through
 * `buildDrill`, which is that same front door.
 *
 * ── No grade, in any of it ───────────────────────────────────────────────────
 * A run that ended early is "the storm got through", never a mark out of ten.
 * The two endings are the same screen in the same order with the same four
 * figures — the heading and what is offered next are all that differ — so
 * there is no arrangement, no colour and no ranking here that a child could
 * read as a score for themselves rather than a report of what the weather
 * did. The score is shown because it is the run's own number and it was on
 * screen the whole time anyway; the XP beside it can only ever have gone up
 * (§8.6), which is the honest thing a losing run has to say.
 *
 * ── Where the board was ──────────────────────────────────────────────────────
 * The panel stands in the board's own grid track, because the board is the gun
 * (`StormField`) and the gun is dead. That leaves the sky above it whole: the
 * hail frozen where it was, and the shield with the hole still in it under the
 * finger this screen is naming. A panel drawn over the sky would have covered
 * the one picture that explains the sentence.
 */
export function StormOver({
  state,
  mode,
  profileId,
  onRetry,
}: {
  state: StormState;
  /**
   * The `Session.mode` this run files under — `typing:L45` (§8.7). It picks
   * the deck family for the drill below and nothing else here reads it.
   */
  mode: string;
  profileId: string;
  /** Replay the same wave from the same seed. The route owns the wave. */
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const { start } = useRace();
  const report = stormReport(state);

  // No ending, nothing to say. `StormField` only puts this where the board was
  // once the run is over, so this is that rule at the type level rather than a
  // second opinion about it — and it is what narrows `report` for the body.
  if (report === null) return null;

  const { breach, bestCombo, shieldLeft, shieldFull, through } = report;
  const ladder = `/p/${profileId}`;

  /**
   * A short passage of just this finger's keys, through the front door every
   * other drill on the site goes through.
   *
   * `buildDrill` is the trouble-facts machinery pointed at a different
   * question (§8.5): the record book asks it for the facts a child keeps
   * missing, and this asks it for the keys behind one finger — but a fact id
   * in a typing deck is a character either way, so the same call builds the
   * same shape of deck and `TypingTrack` runs it with no idea where the list
   * came from. Both options are dropped for a typing deck (`buildDrill`), and
   * passed anyway rather than branched on: a drill has no input mode to
   * choose and no per-word clock.
   */
  function practise(keys: string[]) {
    sfx.select();
    const seed = randomSeed();
    start({
      profileId,
      config: buildDrill(keys, mode, { inputMode: "type", timeLimitMs: null }),
      seed,
      ghost: null,
    });
    navigate(`/p/${profileId}/go`);
  }

  return (
    <section className="storm__over anim-rise" data-finger={breach?.finger}>
      {/* Plain words about the weather, and never a mark. "The storm got
          through" is what happened; a child who just lost is reading it. */}
      <h2 className="u-display storm__verdict">
        {breach ? "The storm got through" : "Wave cleared"}
      </h2>

      {breach ? (
        <p className="storm__lede">
          Your{" "}
          <span className="storm__finger">{FINGER_NAMES[breach.finger]}</span>{" "}
          let {plural(breach.through, "letter")} through.
        </p>
      ) : (
        <p className="storm__lede">
          {through === 0
            ? "Nothing got past you."
            : `Your shield took ${plural(through, "letter")} and held.`}
        </p>
      )}

      {/* The drill, said before it is offered: these are the keys that finger
          is responsible for, and the button below is a passage of them. */}
      {breach && (
        <p className="storm__keys">
          Its keys: <span className="u-mono">{breach.keys.join(" ")}</span>
        </p>
      )}

      <div className="storm__stats">
        <div className="stat">
          <span className="stat__value">
            {shieldLeft}
            <span className="scoreline__of">/{shieldFull}</span>
          </span>
          <span className="stat__label">Shield left</span>
        </div>
        <div className="stat">
          <span className="stat__value">{bestCombo}</span>
          <span className="stat__label">Best combo</span>
        </div>
        <div className="stat">
          <span className="stat__value">{state.score}</span>
          <span className="stat__label">Score</span>
        </div>
        {/* The only number here that could not have gone down (§8.6), in the
            same `--lime` every other screen on this site pays XP out in. */}
        <div className="stat stat--xp">
          <span className="stat__value">+{stormXp(state)}</span>
          <span className="stat__label">XP earned</span>
        </div>
      </div>

      <div className="storm__actions">
        {breach && (
          <Button variant="go" onClick={() => practise(breach.keys)}>
            Practise that finger
          </Button>
        )}
        {/* The same storm, not another one: a wave is replayable from its seed
            (§8.3), and beating one you have already met is the only version of
            this that means you got better. */}
        <Button
          variant={breach ? "accent" : "go"}
          onClick={() => {
            sfx.whoosh();
            onRetry();
          }}
        >
          Try this wave again
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            sfx.tap();
            navigate(ladder);
          }}
        >
          Back to the ladder
        </Button>
      </div>
    </section>
  );
}
