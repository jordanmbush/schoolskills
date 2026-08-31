import { percent } from "@/engine/format";
import { lessonNumbered, type Lesson } from "@/engine/typing/lessons";
import type { LadderProgress } from "@/engine/typing/ladder";
import type { KeyBar, Verdict } from "@/engine/typing/verdict";

/**
 * A verdict, in a sentence a seven-year-old reads once (§6.1).
 *
 * Three bars leave a child to compare each against its mark and work out which
 * one cost them the lesson. This file does that reading for them and says it in
 * words — "you were fast enough; the `z` key needs more practice".
 *
 * Strings rather than JSX on purpose. What is hard here is the *choice* — which
 * bar to name, which to praise, and what a storm says instead — and keeping it
 * as text in, text out is what lets that choice be pinned by a test without a
 * results screen, a router and a hub around it.
 */

/**
 * The new keys, as one bar.
 *
 * A lesson introduces two characters as a rule, but fifteen at lesson 31 — and
 * fifteen bars is a wall rather than a signal. So the bar shown is the key
 * holding you up, because the gate is every key at once (§6.4).
 *
 * "Weakest" is a not-yet-passed key before a lower fraction, which is not the
 * same ordering. A key struck right three times reads 100% and is still not
 * `ok`, because the strike floor is the half of the gate a fraction cannot
 * carry — so a bar that looks full and one that looks nearly full can be the
 * failing one and the passing one respectively.
 */
export function weakestKey(keys: KeyBar[]): KeyBar | null {
  return keys.reduce<KeyBar | null>((worst, key) => {
    if (!worst) return key;
    if (worst.ok !== key.ok) return worst.ok ? key : worst;
    return key.got < worst.got ? key : worst;
  }, null);
}

/** Sentence case and a full stop, so the clauses below can be written plain. */
const sentence = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;

/**
 * Why this run did not pass, and what was already there.
 *
 * Two clauses. The first names the gap in §6.1's order, which is the order to
 * fix them in: a child failing accuracy *and* speed is told about accuracy,
 * because speeding up would only make it worse.
 *
 * The praise is the last bar that was met, read the other way down the same
 * list, which is why it can never name the bar the fix just named. It is not
 * decoration: without it, a child who slows down to fix `z` and drops under the
 * speed bar has been taught the wrong lesson by a screen that only ever said
 * no.
 *
 * Only ever called on a run that did not pass.
 */
export function missNote(lesson: Lesson, verdict: Verdict): string {
  // `Verdict` carries no bar for surviving the wave — §6.1's type leaves `wpm`
  // full and `keys` empty and lets `passed` carry it. Right for the model and
  // wrong on a screen: full bars over the word "failed" read as a bug at seven.
  // So the storm's reason is stated in words here, and `PassBars` draws no bar
  // a storm was never asked for. Which of the two reasons is decidable from the
  // verdict alone: `passed` is accuracy AND survival, so a failed run with its
  // accuracy bar met can only have died in the wave.
  if (lesson.pass.kind === "storm") {
    return verdict.accuracy.ok
      ? sentence("the wave got through — you have to face the whole storm")
      : sentence(
          `the storm wants ${percent(verdict.accuracy.need)} of the letters, and you hit ${percent(verdict.accuracy.got)}`,
        );
  }

  const key = weakestKey(verdict.keys);
  const fix = !verdict.accuracy.ok
    ? `slow down — ${percent(verdict.accuracy.need)} of your words have to be right, and you were at ${percent(verdict.accuracy.got)}`
    : key && !key.ok
      ? `the ${key.key} key needs more practice`
      : `a bit faster — ${verdict.wpm.need} words a minute, and you were at ${Math.round(verdict.wpm.got)}`;

  const praise = verdict.wpm.ok
    ? "you were fast enough"
    : verdict.keys.length > 0 && verdict.keys.every((bar) => bar.ok)
      ? "your new keys are there"
      : verdict.accuracy.ok
        ? "your accuracy is there"
        : null;

  return praise ? sentence(`${praise}; ${fix}`) : sentence(fix);
}

/**
 * Which lesson a pass just opened, and the line that says so (§6.5, §6.6).
 *
 * Unlock is `max(cleared) + 1`, so the run that just cleared the frontier is
 * the one whose number `best` now IS — which is the whole test for "did this
 * open anything". A child at lesson 41 replaying lesson 3 opens nothing, and is
 * told where they are up to instead.
 *
 * **The rung this hands back can be a Hailstorm level** (§8.8, decision 72),
 * and where it is, a second sentence goes with it. A storm offered and left at
 * that reads as a wall to the child who cannot beat a wave, so the offer and
 * the reassurance arrive together, in the same words the storm's own brief
 * uses.
 *
 * `hasKeyboard` is the one case where the storm is not offered at all
 * (`useKeyboardPresence`). On a device with no keys the pointer steps past it
 * to `progress.open`, exactly as the whole ladder used to for everybody: the
 * tile is already shut for that reason, and a results screen that sent a child
 * at a door the ladder had just locked would be the worse half of a guess that
 * is only ever a guess.
 *
 * At the top of the hundred there is nothing ahead and `next` is `null`.
 */
export function nextNote(
  lesson: Lesson,
  progress: LadderProgress,
  hasKeyboard: boolean,
): { next: Lesson | null; text: string } {
  const at = hasKeyboard ? progress.next : progress.open;
  const next = at > lesson.n ? lessonNumbered(at) : null;

  if (!next) {
    return { next, text: "That is the top of the ladder. Every lesson done." };
  }

  const opened =
    progress.best === lesson.n
      ? `Lesson ${next.n} just opened: ${next.title}.`
      : `Next up is lesson ${next.n}: ${next.title}.`;

  // The title already says "Hailstorm", so what is left to say is the part a
  // child cannot see: that the rung behind it came with it.
  const free =
    next.kind.type === "storm" && progress.open > next.n
      ? ` It is worth playing, and lesson ${progress.open} opens whether you do or not.`
      : "";

  return { next, text: opened + free };
}

/**
 * What opens a lesson that is not open yet (§6.6).
 *
 * The rung below it, skipping any Hailstorm level in between (§8.8): clearing
 * lesson 44 is what opens lesson 46, and "pass lesson 45" would send a child at
 * a wave they cannot play on a tablet.
 *
 * One sentence, because it is read on a tile as well as in the brief and ninety
 * tiles offering the same advice about checkpoints is wallpaper — the nudge
 * towards the express lane belongs where a child is stopped, which is the
 * brief.
 *
 * A locked lesson always has a rung below it — lesson 1 is `next` on a profile
 * with no runs at all and can never be locked — but the fallback is written
 * rather than asserted, because a re-cut ladder is data and this is a sentence,
 * not a place to throw.
 */
export function lockNote(lesson: Lesson): string {
  let n = lesson.n - 1;
  while (lessonNumbered(n)?.kind.type === "storm") n -= 1;
  const below = lessonNumbered(n);

  return below
    ? `Pass lesson ${below.n} to open this one.`
    : "This one opens as you climb.";
}
