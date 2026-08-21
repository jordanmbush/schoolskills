/**
 * Hailstorm's rules, both halves: the wave — what falls, where, and when
 * (§8.3) — and the reducer that plays it (§8.4, §8.5).
 *
 * One module because the two halves share the facts that would drift if split:
 * the reducer's damage lands on the shield segment the wave chose, and its
 * "lowest letter" is the interval the wave's schedule is written in.
 *
 * Two constraints on anything added here:
 *
 *   - **It stays model.** No React, no rAF, no DOM, no clock (§8.9). The loop
 *     calls this; so do the tests.
 *   - **It stays out of the chunk every island downloads.** `lessons.ts` is
 *     importable from the deck layer and names `WaveSpec` as a *type*, which
 *     is erased, so this module and the keyboard layout behind it never reach
 *     that chunk (§5.3, §8.6). One value import from `lessons.ts` undoes it.
 *     So there is no table here either: the characters a wave draws from
 *     arrive as `spec.keys`, from a caller that already has them (`storms.ts`,
 *     decision 56).
 */
import { comboMultiplier } from "@/engine/combo";
import { keyX, strokeFor } from "@/engine/keyboard";
import type { Finger } from "@/engine/keyboard";
import { between, mulberry32 } from "@/engine/random";

/**
 * The eight fingers the shield is divided into — every finger but the thumbs
 * (§8.5).
 *
 * A type rather than a convention, so it stays one rule: `fallable` drops any
 * character a thumb types, and a wave therefore can never carry a letter with
 * no segment above it for the reducer to damage.
 */
export type ShieldFinger = Exclude<Finger, "thumb">;

/**
 * One level of Hailstorm, as declared by the lesson that hosts it.
 *
 * `gap` and `fall` are ranges rather than numbers, and the relation between
 * the two is the level's whole difficulty shape (§8.3). `buildWave` holds the
 * arithmetic behind "never more than one letter falling".
 */
export type WaveSpec = {
  /**
   * Which characters can fall — for the twenty levels, everything the lesson
   * has unlocked, with the level's focus weighted up inside it (§5.7).
   *
   * Repeats are the weighting: a character listed twice falls about twice as
   * often. Anything this board cannot produce, and anything a thumb types, is
   * dropped rather than refused — see `fallable`.
   *
   * A level cannot write this field down: the ladder holds a `WaveSpec` minus
   * this one key, and `storms.ts` is the only place the two are joined (§5.7,
   * decision 56).
   */
  keys: string[];
  /** How many letters in the wave. */
  count: number;
  /** ms between spawns — sampled per letter from this range. */
  gap: [number, number];
  /** ms for a letter to cross the field — sampled per letter. */
  fall: [number, number];
  /** Shield hit points per finger zone. */
  shield: number;
  /** Combo needed to repair a zone. 0 = no repairs. */
  repairAt: number;
};

/**
 * One falling letter, decided before the wave starts — everything fixed about
 * it resolved against the keyboard once, up front (§8.3).
 */
export type StormLetter = {
  /** The character, as it is drawn: `f`, `A`, `7`, `?`. */
  ch: string;
  /**
   * `KeyboardEvent.code` of the key that produces it — half of what a press is
   * compared against, `shifted` being the other half (§8.4, decision 2).
   *
   * It is also the code `lane` is a column of, so the thing you press and the
   * place it falls are one fact.
   */
  code: string;
  /**
   * Is this character the SHIFTED legend of its key — `A` rather than `a`, `?`
   * rather than `/`?
   *
   * A shot has to match this as well as the code, and **either** shift
   * produces it (§8.4, decision 70).
   */
  shifted: boolean;
  /**
   * The finger that types it, which is the shield segment above where it
   * lands (§8.5).
   *
   * Carried rather than looked up, so the reducer, the death screen and the
   * drill it offers cannot disagree about where the letter fell.
   */
  finger: ShieldFinger;
  /**
   * The column it falls down: the middle of its key, in key units, measured
   * from the board's left edge (§8.2, decision 19).
   *
   * The board is 15 units wide, so this is a number from 0 to 15 that the
   * field scales by the same `--key` custom property the drawn keyboard uses.
   */
  lane: number;
  /** ms from the start of the wave to this letter appearing at the top. */
  spawnMs: number;
  /**
   * `spawnMs + QUEUE_MS` — when it stops hanging and starts to fall. A letter
   * is on the field, and shootable, from `spawnMs` (§8.3).
   */
  dropMs: number;
  /** ms it takes to cross the field, drawn from `spec.fall`. */
  fallMs: number;
  /**
   * `dropMs + fallMs` — when it reaches the shield. A letter occupies the
   * field on the **half-open** interval `[spawnMs, landMs)` (§8.3).
   *
   * Derived, and stored anyway, because it is read on every tick. Do not order
   * by it to find the lowest letter: letters fall at different speeds, so that
   * is not the same order as `progressAt`, which is what `targetIndex` aims
   * by (§8.4).
   */
  landMs: number;
};

/**
 * A whole storm, replayable from `(spec, seed)`.
 *
 * Both are carried on it so that everything downstream takes one argument: the
 * reducer needs `shield` and `repairAt`, the results screen needs `count`, and
 * the retry button needs the seed.
 *
 * `letters` is in spawn order and **a letter's index is its identity** — for
 * the reducer's "which are in the air", and for a React key (§8.3).
 */
export type Wave = {
  spec: WaveSpec;
  seed: number;
  letters: StormLetter[];
  /**
   * ms from the start of the wave until the last letter lands, or 0 if nothing
   * falls. The max rather than the last letter's, because a slow letter
   * spawned early can land after a fast one spawned later.
   */
  durationMs: number;
};

/** A character the board can drop, with everything fixed about it resolved. */
type Fallable = Pick<
  StormLetter,
  "ch" | "code" | "shifted" | "finger" | "lane"
>;

/**
 * A character as a thing that could fall, or `null` if it cannot.
 *
 * Everything here is read off `engine/keyboard.ts` and nothing is restated.
 * Two kinds of character are dropped rather than refused: one this board
 * cannot produce (the same null `strokeFor` that `reachable()` is built out
 * of, §5.2), and one a thumb types — the shield has no thumb segment, and the
 * unlocked alphabet a caller passes as `spec.keys` always carries a space
 * (§8.3).
 */
function fallable(ch: string): Fallable | null {
  const stroke = strokeFor(ch);
  if (!stroke) return null;
  if (stroke.finger === "thumb") return null;
  const lane = keyX(stroke.code);
  // Unreachable: every stroke names a key on this board, because `strokeFor`
  // was built from the same table `keyX` reads. Skipping the character is
  // still cheaper than asserting the null away, and it cannot hide a bug — a
  // wave short of a character it should have had is what the pool test sees.
  if (lane === null) return null;
  return {
    ch,
    code: stroke.code,
    // `Stroke.shift` names WHICH shift the technique wants; what falls out of
    // it here is only whether one is wanted at all.
    shifted: stroke.shift !== null,
    finger: stroke.finger,
    lane,
  };
}

/**
 * The fastest a letter may ever cross the sky, in ms (§8.10, decision 52).
 *
 * A backstop in the generator rather than a floor written into the twenty
 * levels, so no row of that table can forget it. It bites only on a spec that
 * asked for something faster than the ladder ever intends.
 *
 * **There is deliberately no `MIN_GAP_MS` beside it, and the symmetry is a
 * trap.** A gap floor would cost the density the top of the ladder is built
 * out of and buy almost no safety; what the twenty levels keep instead is a
 * per-zone cap on tints per second (§8.10). The other half of that rule is
 * `MIN_TINT_GAP_MS` below, for the flash no wave can shape.
 */
export const MIN_FALL_MS = 800;

/**
 * How long a letter hangs at the top of the sky before it starts to fall
 * (§8.3, decision 67).
 *
 * A queued letter is on the field, and shootable, the whole time it hangs
 * there.
 *
 * A second is a judgement and not a measurement. Round, long enough to read an
 * unfamiliar glyph without hurrying, and short enough that a level with a
 * 300ms gap still has a queue rather than a crowd.
 */
export const QUEUE_MS = 1000;

/**
 * The fall times a spec can actually produce — its own range, floored at
 * `MIN_FALL_MS`.
 *
 * Exported so that nothing re-derives the clamp. Anything asking whether a
 * level is "one letter at a time" has to read the schedule the wave was built
 * with rather than the one it was declared with, because a floor can only
 * raise a fall (§8.10).
 */
export function fallRange(spec: WaveSpec): [number, number] {
  return [
    Math.max(MIN_FALL_MS, spec.fall[0]),
    Math.max(MIN_FALL_MS, spec.fall[1]),
  ];
}

/**
 * The whole wave, from a seed.
 *
 * Deterministic in `(spec, seed)` and in nothing else: no clock is read and
 * `Math.random` is never called, here or below. The **draw order** — the gap
 * in front of a letter, then which letter, then how fast it falls — is
 * therefore part of what a seed means. Reordering those three lines re-rolls
 * every storm, including the twenty seeds that ship (§5.7).
 *
 * "Never more than one letter falling" is a property of the spec rather than a
 * hope about the draw: `gap[0] >= fall[1]` buys it exactly, and the boundary
 * goes to safety because the interval is half-open (§8.3). That arithmetic is
 * read against `fallRange(spec)` and never against `spec.fall` (§8.10).
 */
export function buildWave(spec: WaveSpec, seed: number): Wave {
  const rand = mulberry32(seed);
  const fall = fallRange(spec);

  // Filtered once, up front. An empty pool builds an empty wave rather than
  // throwing — the engine's habit that a mode which no longer makes sense
  // still opens (§8.3).
  const pool = spec.keys
    .map(fallable)
    .filter((entry): entry is Fallable => entry !== null);

  const letters: StormLetter[] = [];
  let spawnMs = 0;
  for (let i = 0; i < spec.count && pool.length > 0; i++) {
    // The gap is the time since the previous spawn, so the first letter has
    // none. Not sampled-and-discarded for i = 0, because a draw nobody uses is
    // still part of what the seed means.
    if (i > 0) spawnMs += between(spec.gap[0], spec.gap[1], rand);
    const from = pool[between(0, pool.length - 1, rand)];
    const fallMs = between(fall[0], fall[1], rand);
    // Every letter waits the same beat, so this shifts the whole schedule and
    // warps none of it — and draws nothing from `rand`.
    const dropMs = spawnMs + QUEUE_MS;
    letters.push({ ...from, spawnMs, dropMs, fallMs, landMs: dropMs + fallMs });
  }

  return {
    spec,
    seed,
    letters,
    durationMs: letters.reduce((last, l) => Math.max(last, l.landMs), 0),
  };
}

/* ═══ The reducer: the wave, played (§8.4, §8.5, §8.9) ═══════════════════════
 *
 * Everything below is a pure function of the state it is handed. The loop
 * reads a real clock and calls `tick` with the delta; the tests call the same
 * functions with numbers.
 */

/**
 * Is this letter on the field at `timeMs` — queued or falling?
 *
 * The half-open interval `[spawnMs, landMs)` (§8.3, decision 30), exported as
 * a predicate rather than spelled out at each of its three readers —
 * `targetIndex`, `tick` and the field — where it would be three chances to
 * pick the wrong side of a millisecond, and the wrong side is a letter that is
 * both shootable and already spent.
 *
 * `hasLanded` is deliberately not `!isAirborne`: a letter that has not spawned
 * yet is neither on the field nor landed, and the reducer must not charge the
 * shield for a letter that has not fallen.
 */
export function isAirborne(letter: StormLetter, timeMs: number): boolean {
  return letter.spawnMs <= timeMs && timeMs < letter.landMs;
}

/**
 * Is this letter actually coming down at `timeMs`, rather than waiting to?
 *
 * Nothing in the reducer reads it — the rules care about what is on the field
 * and what has landed, and neither of those is this. It is here because "one
 * letter at a time" is a claim about falling that the twenty levels are held
 * to, and a test restating the interval would be a second opinion about
 * `QUEUE_MS` (§8.3).
 */
export function isFalling(letter: StormLetter, timeMs: number): boolean {
  return letter.dropMs <= timeMs && timeMs < letter.landMs;
}

/** Has this letter reached the shield by `timeMs`? See `isAirborne`. */
export function hasLanded(letter: StormLetter, timeMs: number): boolean {
  return letter.landMs <= timeMs;
}

/**
 * How far down the field a letter is at `timeMs`: 0 at the top, 1 at the shield.
 *
 * One function rather than an expression repeated, because two readers must
 * agree exactly: the renderer writes it into a `translateY`, and `targetIndex`
 * takes the maximum of it. A child aims by looking, so the letter the game
 * thinks is lowest has to be the one drawn lowest.
 *
 * **Floored at zero**: a queued letter has made no progress, and both readers
 * need it to read that way (§8.3).
 *
 * `fallMs` cannot be 0 while a letter is falling — `drop <= t < drop + fall`
 * has no solutions at `fall = 0` — so the division is safe everywhere the
 * value is a position. Past the landing it still answers, and answers
 * honestly: greater than 1.
 */
export function progressAt(letter: StormLetter, timeMs: number): number {
  return Math.max(0, (timeMs - letter.dropMs) / letter.fallMs);
}

/**
 * The eight shield segments, in board order — left pinky to right pinky.
 *
 * An order rather than a set, because a repair has to break a tie between
 * equally weak zones somehow, and this is the order the shield is drawn in
 * (§8.5). The tie-break is then at least a thing a child could watch happen.
 */
export const SHIELD_FINGERS: readonly ShieldFinger[] = [
  "l-pinky",
  "l-ring",
  "l-middle",
  "l-index",
  "r-index",
  "r-middle",
  "r-ring",
  "r-pinky",
];

/** Hit points left in each of the eight zones. A zone at 0 is a hole (§8.5). */
export type Shield = Readonly<Record<ShieldFinger, number>>;

/**
 * What became of one letter, and when.
 *
 * `atMs` is wave time: the press for a letter that was shot, and the letter's
 * own `landMs` for one that got through — its own landing and not the tick
 * that noticed it, because a tick can arrive several landings late (see
 * `tick`), and a card timing a backgrounded tab would put a nonsense number in
 * a child's record book for ever (§8.7).
 *
 * `combo` is the streak the shot left the run on, and 0 for a letter that got
 * through. Recorded because it cannot be recovered: a wrong key breaks the
 * combo and resolves no letter, so nothing in `resolved` remembers it.
 */
export type LetterOutcome = {
  outcome: "shot" | "landed";
  atMs: number;
  combo: number;
};

/**
 * How a run finished, or `null` while it is still going.
 *
 * `breached` carries the finger taken from the letter as it got through, never
 * re-derived afterwards from a shield that by then reads the same at several
 * zones (§8.5). `index` is the letter that ended it: what the death screen can
 * show, and where its drill starts.
 */
export type StormEnding =
  | { kind: "cleared" }
  | { kind: "breached"; finger: ShieldFinger; index: number };

/**
 * A run, mid-storm.
 *
 * Everything here is a fact that cannot be recovered from the wave and the
 * clock, and nothing here is a fact that can. No list of letters on screen, no
 * cached lowest letter, no per-finger tally of what got through — each of
 * those already falls out of a schedule decided before the run started, and a
 * second copy is a second thing to keep in step sixty times a second.
 *
 * `resolved` is parallel to `wave.letters` and indexed by the letter's
 * identity (§8.3). Indexed rather than appended to, because resolution is
 * **not** in spawn order: shoot the middle one of three and the array gets a
 * hole in it. It is a card **per resolved letter**, not per index — a run that
 * ended early leaves holes in here, and they are the letters that never
 * happened (§8.7, `stormSession.ts`).
 */
export type StormState = {
  /** The storm being played. Decided before the run; never changes during it. */
  readonly wave: Wave;
  /** ms since the wave started. Only ever moves forward. */
  readonly timeMs: number;
  /** Hit points left in each zone. Starts at `wave.spec.shield` all round. */
  readonly shield: Shield;
  /**
   * What each letter came to, parallel to `wave.letters` — `null` while it is
   * still to spawn or still falling.
   */
  readonly resolved: readonly (LetterOutcome | null)[];
  /**
   * Consecutive hits, unbroken by a miss or by a letter getting through.
   *
   * State and not a view's counter because two rules read it: every `repairAt`
   * of them puts a point back into the weakest zone (§8.5), and the score
   * multiplier hangs on the same number — so the ×1.6 in the HUD is the ×1.6
   * the XP is worth (§8.6).
   */
  readonly combo: number;
  /**
   * The run's own score. Starts at 0, and **may go negative** (§8.6).
   *
   * Kept rather than derived because it cannot be derived: a wrong key costs
   * points and resolves no letter, so `resolved` has no record of it, and the
   * multiplier a hit was paid at is history the moment the streak moves on.
   *
   * It is not XP and it never becomes XP (§8.6).
   */
  readonly score: number;
  /**
   * Wrong keys — shots that hit nothing, including shots at an empty sky.
   *
   * A count and not a list, because what reads it wants a number.
   *
   * **It is the run's own number and does not reach the record book.** A card
   * is a letter's outcome, so a saved session's `incorrect` counts what got
   * through and nothing else (§8.7, decision 48). What a miss cost is saved in
   * the streak it broke.
   *
   * It is **not** what the HUD's flash is mounted from — see `missTintAt`
   * below, which is the half of this that a hand can strobe.
   */
  readonly misses: number;
  /**
   * When the score's `--flare` wash last started, in wave time — `null` before
   * the first one. **A new value is a new flash, and an unchanged one is the
   * same element left alone** (§8.10, decision 42).
   *
   * The HUD keys its wash off this rather than off `misses`, which is what
   * lets a miss be charged in full while the flash it would have lit is held
   * back — see `MIN_TINT_GAP_MS` for why that throttle is in the reducer.
   */
  readonly missTintAt: number | null;
  /** How the run finished, or `null` while it is live. */
  readonly ending: StormEnding | null;
};

/**
 * What a clean hit is worth before the combo multiplier, and what a wrong key
 * costs (§8.6).
 *
 * Equal, and that is the whole of the balance: one wrong key undoes one plain
 * hit. A letter that gets through costs neither, having already cost a shield
 * point (decision 46).
 */
export const HIT_POINTS = 10;
export const MISS_POINTS = 10;

/**
 * The least time between two starts of the score's miss wash, in wave ms
 * (§8.10, decision 57).
 *
 * WCAG 2.3.1 draws its line at more than three flashes inside one second, and
 * 500ms holds the wash to two starts a second — the same headroom the twenty
 * waves' zone tints ship with. The smaller round values do not, and the
 * arithmetic is in §8.10.
 *
 * **The throttle is here in the reducer and not in the HUD**, because the
 * reducer is the only thing on this screen holding a clock. A wave's tint rate
 * can be read off its schedule in advance; a miss happens when a child presses
 * a wrong key, so its rate is the rate a hand can move at, and only something
 * watching the live run can bound it. In the view this would be a `useRef`
 * keeping a second clock that then has to agree with this one. A miss inside
 * the gap still costs the points and still breaks the streak — it simply does
 * not re-light a wash that is already lit.
 *
 * Longer than the wash is drawn for, too, so a fast hand gets a wash that
 * lights, fades and is then allowed to light again, never one that blinks off
 * and on inside its own animation.
 *
 * **Wave time, not wall-clock time**, so the quit sheet's pause cannot spend
 * it: a run resumed after a minute behind the sheet is exactly where it was
 * (§8.11).
 */
export const MIN_TINT_GAP_MS = 500;

/**
 * Stamp `cleared` on a state whose last letter has just been accounted for.
 *
 * Cleared is "every letter resolved" rather than "the clock passed
 * `durationMs`", because shooting the last letter ends the wave there and
 * then; the alternative leaves a child watching an empty field for the second
 * and a half that letter would have taken to fall.
 */
const settled = (state: StormState): StormState =>
  state.ending !== null || state.resolved.some((outcome) => outcome === null)
    ? state
    : { ...state, ending: { kind: "cleared" } };

/**
 * A run at time zero: full shield, nothing resolved, no streak.
 *
 * The wave is carried, not copied. The retry button, the results screen and
 * the reducer are all meant to be looking at the same storm.
 *
 * An empty wave is born `cleared`, so a loop can never be left waiting on a
 * letter that will never spawn (§8.3).
 */
export function startStorm(wave: Wave): StormState {
  const shield = Object.fromEntries(
    SHIELD_FINGERS.map((finger) => [finger, wave.spec.shield]),
  ) as Record<ShieldFinger, number>;

  return settled({
    wave,
    timeMs: 0,
    shield,
    resolved: wave.letters.map(() => null),
    combo: 0,
    score: 0,
    misses: 0,
    missTintAt: null,
    ending: null,
  });
}

/**
 * The lowest letter on the field, as an index into `wave.letters` — or `null`
 * if nothing is on it.
 *
 * **Lowest is the greatest `progressAt`, and not the earliest `landMs`**, and
 * on an exact tie the lower index wins, which is the earlier spawn (§8.4).
 *
 * It does not read `state.ending`. A run that ended mid-wave still has letters
 * in the air, so this still names one; `fire` asks only after its own guard,
 * and a screen that marks a child's keys against it (`aimedAt`) has to guard
 * too.
 */
export function targetIndex(state: StormState): number | null {
  const { letters } = state.wave;
  let lowest: number | null = null;
  let best = -Infinity;

  for (let index = 0; index < letters.length; index++) {
    const letter = letters[index];
    if (state.resolved[index] !== null) continue;
    if (!isAirborne(letter, state.timeMs)) continue;
    const progress = progressAt(letter, state.timeMs);
    // Strictly greater, so a tie leaves the earlier index where it is.
    if (progress > best) {
      best = progress;
      lowest = index;
    }
  }

  return lowest;
}

/**
 * The shield after a hit, with `repairAt` applied — into the weakest zone,
 * never the last one damaged (§8.5).
 *
 * Two edges, both deliberate:
 *
 *   - **`repairAt: 0` disables repairs**, as `WaveSpec` declares — checked
 *     rather than left to `combo % 0` being `NaN`. That the arithmetic falls
 *     the right way on its own is the problem, not the reassurance: the same
 *     expression hands a *negative* `repairAt` a repair every other hit.
 *   - **No zone ever exceeds `spec.shield`** (§8.5). At the cap the repair is
 *     spent rather than banked — banking it would be a hit point arriving at a
 *     moment nothing on screen explains.
 */
function repaired(shield: Shield, spec: WaveSpec, combo: number): Shield {
  if (spec.repairAt <= 0 || combo % spec.repairAt !== 0) return shield;

  // Ties go to the first in board order: deterministic, and the order the
  // shield is drawn in, so the segment that lights up is one a child could in
  // principle have predicted.
  const weakest = SHIELD_FINGERS.reduce((low, finger) =>
    shield[finger] < shield[low] ? finger : low,
  );

  return shield[weakest] >= spec.shield
    ? shield
    : { ...shield, [weakest]: shield[weakest] + 1 };
}

/**
 * Advance the clock, and resolve everything that reached the shield on the way.
 *
 * `dtMs` is whatever the loop hands over, and **every** landing inside the
 * interval is resolved in the order it happened, including ones that spawned
 * and landed inside a single tick (§8.9). Clamping a long delta is the loop's
 * decision to make deliberately, and so is keeping a non-finite one out: a
 * `NaN` delta poisons `timeMs` for the rest of the run and ends nothing.
 *
 * A returned state is always a new object, even from a tick with no landing,
 * so `===` is not a "nothing changed" signal (§8.9, decision 40).
 */
export function tick(state: StormState, dtMs: number): StormState {
  if (state.ending !== null) return state;

  // Time only moves forward. A clock handing back a negative delta is a bug in
  // the loop, and rewinding the storm — un-landing letters the shield has
  // already paid for — is not a recovery from it.
  const timeMs = state.timeMs + Math.max(0, dtMs);

  const landings = state.wave.letters
    .map((letter, index) => ({ letter, index }))
    .filter(
      ({ letter, index }) =>
        state.resolved[index] === null && hasLanded(letter, timeMs),
    )
    // In the order they happened, which is not spawn order: a fast letter
    // spawned second can land first, and which zone breaks first decides which
    // finger the death screen names. A dead heat falls back to the letter's
    // index — its identity (§8.3) — so a replay resolves it the same way.
    .sort((a, b) => a.letter.landMs - b.letter.landMs || a.index - b.index);

  if (landings.length === 0) return { ...state, timeMs };

  const resolved = state.resolved.slice();
  const shield = { ...state.shield };
  let combo = state.combo;
  let ending: StormEnding | null = null;
  let clock = timeMs;

  for (const { letter, index } of landings) {
    // Combo 0 on the outcome as well as on the run: a letter that got through
    // was shot on no streak at all.
    resolved[index] = { outcome: "landed", atMs: letter.landMs, combo: 0 };
    combo = 0;

    if (shield[letter.finger] <= 0) {
      // The zone above it is a hole, so there is nothing left to take the hit.
      // The clock stops at that landing rather than at the end of the tick:
      // the rest of this interval never happened, and the letters still due
      // inside it stay unresolved rather than being charged to a shield the
      // child no longer had. That includes a letter tying this exact `landMs`
      // from a higher index, which `hasLanded` now reads true of — so "got
      // through" counts `resolved`, never `hasLanded`.
      ending = { kind: "breached", finger: letter.finger, index };
      clock = letter.landMs;
      break;
    }

    shield[letter.finger] -= 1;
  }

  return settled({ ...state, timeMs: clock, shield, resolved, combo, ending });
}

/**
 * Did this press produce this letter's character?
 *
 * Both halves, because between them they ARE the character: `code` is the half
 * that survives whatever else is being held down, and `shifted` is the half
 * that tells the key's two legends apart (§8.4, decisions 2 and 70).
 *
 * A predicate rather than two clauses inside `fire`'s guard, because the guard
 * has to keep narrowing `index` away from `null` for the lines below it.
 */
function struck(letter: StormLetter, code: string, shift: boolean): boolean {
  return letter.code === code && letter.shifted === shift;
}

/**
 * Fire at the lowest letter on screen. Anything else is a miss, a shot at an
 * empty field included (§8.4).
 *
 * The rule follows the field and not the schedule: nearest is not soonest,
 * because letters fall at different speeds (decision 32, and `targetIndex`). A
 * target picked by `landMs` would refuse the letter the child is watching drop
 * and demand one they had no way to know was closer in time.
 */
export function fire(
  state: StormState,
  code: string,
  /**
   * Was a shift held down as the key went down — `event.shiftKey`, either
   * hand?
   *
   * Defaulted, and the default is the ordinary stroke: no shift. It is safe to
   * leave off only because getting it wrong can make a shot stricter and never
   * looser — a caller that forgets it can no longer shoot a capital at all
   * (§8.4, decision 70).
   */
  shift = false,
): StormState {
  if (state.ending !== null) return state;

  const index = targetIndex(state);
  if (index === null || !struck(state.wave.letters[index], code, shift))
    // A miss: the streak, the score and a mark against the run. Nothing on the
    // field moves — the letter the child should have shot is still falling,
    // which is the other half of the cost. Only the flash is rate-limited; the
    // points, the streak and the mark are taken either way (§8.10).
    return {
      ...state,
      combo: 0,
      score: state.score - MISS_POINTS,
      misses: state.misses + 1,
      missTintAt:
        state.missTintAt === null ||
        state.timeMs - state.missTintAt >= MIN_TINT_GAP_MS
          ? state.timeMs
          : state.missTintAt,
    };

  const resolved = state.resolved.slice();
  const combo = state.combo + 1;
  resolved[index] = { outcome: "shot", atMs: state.timeMs, combo };

  return settled({
    ...state,
    resolved,
    combo,
    // Paid at the multiplier the hit LANDS on, not the one before it: the
    // fifth hit in a row is worth ×1.5, which is the number the HUD is already
    // showing by the time a child looks at it. Same convention as
    // `cardXp(ms, streakAfter)`, which pays the same hit in XP (§8.6).
    score: state.score + Math.round(HIT_POINTS * comboMultiplier(combo)),
    shield: repaired(state.shield, state.wave.spec, combo),
  });
}

/* ═══ What a run came to (§8.5, §8.7) ════════════════════════════════════════
 *
 * The questions the ending screen asks, answered here so that the screen holds
 * no rules. XP is the one it cannot ask for: `stormXp` sits in `progress.ts`,
 * on the far side of the deck layer this module stays clear of (§8.5, and the
 * file header).
 */

/** What one zone has been through: the two things worth drawing an event for. */
export type ZoneTally = {
  /** Letters that reached this zone. Each is one damage tint. */
  readonly hit: number;
  /** Points repaired back into it (§8.5). Each is one mend pulse. */
  readonly mend: number;
};

/**
 * The eight zones' histories, from the run itself.
 *
 * **Counted off `resolved`, and never off `hasLanded`.** A breach stops the
 * clock at the fatal `landMs`, which leaves a letter tying that millisecond
 * from a higher index unresolved while the clock already reads it as landed —
 * so asking the clock over-reports the number this screen is about (§8.5, and
 * `tick`).
 *
 * `mend` is arithmetic over the same: a zone's hit points are
 * `spec.shield - absorbed + repairs` by construction. **Absorbed, not
 * landed** — the letter that ends a run falls on a zone already at nothing and
 * takes no point off it (`tick` breaks before the decrement), so counting it
 * would read as a phantom repair on the frame a child dies. It still tints,
 * which is why the two counters are separate.
 */
export function zoneTally(state: StormState): Record<ShieldFinger, ZoneTally> {
  const full = state.wave.spec.shield;
  const fatal = state.ending?.kind === "breached" ? state.ending.index : -1;

  const hit = {} as Record<ShieldFinger, number>;
  const absorbed = {} as Record<ShieldFinger, number>;
  for (const finger of SHIELD_FINGERS) {
    hit[finger] = 0;
    absorbed[finger] = 0;
  }

  state.resolved.forEach((outcome, index) => {
    if (outcome?.outcome !== "landed") return;
    const { finger } = state.wave.letters[index];
    hit[finger] += 1;
    if (index !== fatal) absorbed[finger] += 1;
  });

  return Object.fromEntries(
    SHIELD_FINGERS.map((finger) => [
      finger,
      {
        hit: hit[finger],
        mend: state.shield[finger] + absorbed[finger] - full,
      },
    ]),
  ) as Record<ShieldFinger, ZoneTally>;
}

/**
 * The characters this wave could drop on one finger — the drill a hole earns.
 *
 * `spec.keys` and not the whole board, which is the difference between a drill
 * and a punishment (§8.5). It is never empty after a breach: whatever got
 * through was drawn from this same pool wearing this same finger.
 *
 * Filtered through `fallable`, so this and the wave agree by construction
 * about which finger types what, and drop the same characters.
 */
export function zoneKeys(wave: Wave, finger: ShieldFinger): string[] {
  // The `Set` is the de-duplication and the order in one: it keeps first-seen
  // order, and `filter` keeps whatever order it is handed — so a pool's own
  // sequence survives into the drill it earns.
  return [...new Set(wave.spec.keys)].filter(
    (ch) => fallable(ch)?.finger === finger,
  );
}

/**
 * The longest streak the run ever reached.
 *
 * Recovered from `resolved` rather than kept on the run: `LetterOutcome.combo`
 * is the streak each hit landed on and a streak only ever climbs by one, so
 * the largest of them IS the longest run of clean hits (§8.5). A field for it
 * would be a second number to move on every hit.
 *
 * Zero for a run that never hit anything, which is also what a run that never
 * started answers — and the right answer to both.
 */
export function bestCombo(state: StormState): number {
  return state.resolved.reduce<number>(
    (best, outcome) =>
      outcome?.outcome === "shot" ? Math.max(best, outcome.combo) : best,
    0,
  );
}

/**
 * Everything the ending screen says, decided (§8.5).
 *
 * `null` while the run is live, so a screen cannot draw an ending that has not
 * happened: the one call answers "is it over" and "what happened" together,
 * where two would let a caller ask the second without the first.
 */
export type StormReport = {
  /** How the run finished. Never `null` — there is no report without one. */
  readonly ending: StormEnding;
  /**
   * The zone that let the storm through, or `null` on a wave that was cleared.
   *
   * `through` counts every letter that got past this finger and not only the
   * fatal one: the run of them is the story, and the last is just the one that
   * found the hole they had already made.
   */
  readonly breach: {
    readonly finger: ShieldFinger;
    readonly through: number;
    /** What to practise: this finger's keys, out of the wave's own pool. */
    readonly keys: string[];
  } | null;
  /** Hit points left across all eight zones… */
  readonly shieldLeft: number;
  /** …out of the eight-of-`shield` every run starts with (§8.5). */
  readonly shieldFull: number;
  /**
   * Letters that got past the shield anywhere, the fatal one included.
   *
   * Not `shieldFull - shieldLeft`: a zone that was hit and then repaired is
   * back to full, and a run that was hit and mended is not a run that was
   * never hit. Zero is the untouched run (§8.5).
   */
  readonly through: number;
  /** The longest run of clean hits. See `bestCombo`. */
  readonly bestCombo: number;
};

export function stormReport(state: StormState): StormReport | null {
  const { ending, shield, wave } = state;
  if (ending === null) return null;

  const tally = zoneTally(state);
  const shieldLeft = SHIELD_FINGERS.reduce(
    (sum, finger) => sum + shield[finger],
    0,
  );

  return {
    ending,
    breach:
      ending.kind === "breached"
        ? {
            finger: ending.finger,
            through: tally[ending.finger].hit,
            keys: zoneKeys(wave, ending.finger),
          }
        : null,
    shieldLeft,
    shieldFull: SHIELD_FINGERS.length * wave.spec.shield,
    through: SHIELD_FINGERS.reduce((sum, finger) => sum + tally[finger].hit, 0),
    bestCombo: bestCombo(state),
  };
}
