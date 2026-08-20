/**
 * Hailstorm's rules, both halves: the wave — what falls, where, and when
 * (docs/typing.md §8.3) — and the reducer that plays it (§8.4, §8.5).
 *
 * They are one module because they are one set of rules and the seam between
 * them is a lie waiting to happen: the reducer's damage lands on the shield
 * segment the wave already chose for a letter, and its "lowest letter" is the
 * half-open interval the wave's schedule is written in. Two files would be two
 * places to state each of those, and the second copy is always the one that
 * drifts.
 *
 * A wave is generated **whole, up front, from a seed**, exactly as every deck
 * on this site is. That is not a stylistic echo — it is the story this module
 * exists for. A child who has just lost wants to retry *the storm that beat
 * them*, and a game that rolled its next letter as it went could only ever
 * offer them a different one. Beating a wave you have met before means you got
 * better; beating a fresh one means you got luckier, and a five-year-old can
 * tell the difference even when they cannot say it.
 *
 * The second thing it buys is this file being testable at all. Spawn schedule,
 * lanes and fall speeds are plain arithmetic over plain data here, so "is there
 * ever more than one letter on screen at this level" is a question a unit test
 * asks in a millisecond rather than a thing somebody watches for and hopes.
 *
 * ── Model, and it has to stay model ──────────────────────────────────────────
 * No React, no rAF, no DOM, no clock (§8.9). The loop calls this; the tests
 * call it too. The only reason the loop is allowed to be dumb — write a
 * transform, do nothing else — is that everything it would otherwise have to
 * decide was decided here, before the first frame.
 *
 * ── And it has to stay small ─────────────────────────────────────────────────
 * `lessons.ts` is importable from the deck layer, and STM10 puts a `WaveSpec`
 * on each of the twenty storm lessons — which will make this module reachable
 * from `decks/index.ts`, the front door every island on the site downloads
 * (§5.3, decision 7). So it must never grow a table. There is nothing here but
 * the spec, the RNG, the keyboard and the rules: the characters a wave draws
 * from arrive as `spec.keys`, from a caller that already knows them.
 */
import { comboMultiplier } from "@/engine/combo";
import { keyX, strokeFor } from "@/engine/keyboard";
import type { Finger } from "@/engine/keyboard";
import { between, mulberry32 } from "@/engine/random";

/**
 * The eight fingers the shield is divided into — every finger but the thumbs.
 *
 * The shield spans the bottom of the field in one segment per finger (§8.5),
 * and thumbs are excluded because nothing falls on the space bar. Stating that
 * as a type rather than as a convention is what makes it one rule instead of
 * two: the pool filter below drops any character typed with a thumb, so a wave
 * can never carry a letter with no segment above it — which is the case the
 * reducer would otherwise have to invent an answer for at the worst moment.
 */
export type ShieldFinger = Exclude<Finger, "thumb">;

/**
 * One level of Hailstorm, as declared by the lesson that hosts it.
 *
 * `gap` and `fall` are **ranges rather than numbers**, and that is what "the
 * storm is sometimes random within the level" means: each letter draws its own
 * spawn delay and its own fall time. The relationship between the two ranges is
 * the level's whole difficulty shape:
 *
 *   - `gap` at or above `fall` → a letter lands before the next one spawns, so
 *     there is never more than one on screen and the game is pure reaction.
 *     That is what the early levels are (see `buildWave` for the arithmetic).
 *   - `gap` below `fall` → two or three in the air at once, and the child has
 *     to work bottom-up. Which is reading ahead, which is the thing that makes
 *     a fast typist.
 */
export type WaveSpec = {
  /**
   * Which characters can fall. Usually "everything unlocked by lesson n".
   *
   * Order and repeats are the caller's to use: a character listed twice falls
   * about twice as often, which is how a level built around six new symbols
   * weights them above the forty a child already has. Anything this board
   * cannot produce, and anything typed with a thumb, is dropped rather than
   * refused — see `buildWave`.
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
 * One falling letter, decided before the wave starts.
 *
 * Everything a frame, a hit or a death needs to know about it is here, so that
 * the reducer never has to ask the keyboard a question mid-run and the renderer
 * never has to do arithmetic: `lane` is where to draw it, `spawnMs`/`fallMs`
 * are where it is at time _t_, `code` is what shoots it and `finger` is the
 * shield segment it breaks if nothing does.
 */
export type StormLetter = {
  /** The character, as it is drawn: `f`, `A`, `7`, `?`. */
  ch: string;
  /**
   * `KeyboardEvent.code` of the key that produces it — what a press is
   * compared against.
   *
   * `code`, not the character (decision 2): a shifted legend and its base
   * share a key, so `A` and `a` are both fired by `KeyA` and the shift a child
   * is holding cannot make the shot miss. It is also the code the lane is a
   * column of, so the thing you press and the place it falls are one fact.
   */
  code: string;
  /**
   * The finger that types it, which is the shield segment above where it
   * lands (§8.5).
   *
   * Carried rather than looked up so that the reducer, the death screen and
   * the drill it offers all read the same value. A hole under the right ring
   * finger is the best thing this game tells a child about their own hands,
   * and it must not be able to disagree with where the letter actually fell.
   */
  finger: ShieldFinger;
  /**
   * The column it falls down: the middle of its key, in key units from the
   * left edge of the board (§8.2, decision 19).
   *
   * The board is 15 units wide, so this is a number from 0 to 15 that the
   * field scales by the same `--key` custom property the drawn keyboard uses.
   * `f` falls onto `f`; `y` falls between `g` and `h`, because that is where
   * `y` is.
   */
  lane: number;
  /** ms from the start of the wave to this letter appearing at the top. */
  spawnMs: number;
  /** ms it takes to cross the field, drawn from `spec.fall`. */
  fallMs: number;
  /**
   * `spawnMs + fallMs` — when it reaches the shield.
   *
   * A letter occupies the field on the **half-open** interval
   * `[spawnMs, landMs)`: it is there the instant it spawns and gone the instant
   * it lands, because landing is the tick that resolves it into damage. That
   * convention is what makes `gap === fall` the safe side of the boundary in
   * `buildWave`'s no-overlap guarantee, so it is written down here rather than
   * left for the reducer to pick again.
   *
   * Derived, and stored anyway, because it is read on every tick. One warning
   * belongs with it: the *lowest* letter on screen is the one with the greatest
   * `(t - spawnMs) / fallMs`, which is not the same order as `landMs` once two
   * letters fall at different speeds. Two orderings that look interchangeable
   * and part company exactly where it matters are worth a sentence — and, now
   * that something depends on the difference, a function: `targetIndex` aims by
   * `progressAt` and never by this field.
   */
  landMs: number;
};

/**
 * A whole storm, replayable from `(spec, seed)`.
 *
 * Both are carried on it so that everything downstream takes one argument: the
 * reducer needs `shield` and `repairAt`, the results screen needs `count`, and
 * the retry button needs the seed — which is this story's whole point.
 *
 * `letters` is in spawn order, and **the index is the letter's identity** —
 * for the reducer's "which are in the air", and for a React key. The wave is
 * built once and never grows, so nothing can shift under either of them.
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
type Fallable = Pick<StormLetter, "ch" | "code" | "finger" | "lane">;

/**
 * A character as a thing that could fall, or `null` if it cannot.
 *
 * Everything here is read off `engine/keyboard.ts` and nothing is restated:
 * the layout knows which key produces a character, which finger presses it and
 * where that key sits. Two characters get dropped, for different reasons:
 *
 *   - **This board cannot produce it.** A curly quote, an em dash, a letter
 *     from another layout. Same null `strokeFor` that `reachable()` is built
 *     out of (§5.2) — a wave that dropped one would be unshootable.
 *   - **A thumb types it.** The space bar, and nothing else that types a
 *     character. The shield has no thumb segment (§8.5), so a falling space
 *     would have nothing above it to damage. Spaces matter here because the
 *     unlocked alphabet a caller passes as `spec.keys` always contains one.
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
  return { ch, code: stroke.code, finger: stroke.finger, lane };
}

/**
 * The whole wave, from a seed.
 *
 * Deterministic in `(spec, seed)` and in nothing else: no clock is read and
 * `Math.random` is never called, here or below. The **draw order** — the gap in
 * front of a letter, then which letter, then how fast it falls — is therefore
 * part of what a seed means. Reordering those three lines re-rolls every storm,
 * which is free today and is not free the moment a level's seed is written down
 * beside a saved run (STM08).
 *
 * ── Why `gap ≥ fall` means one letter at a time ──────────────────────────────
 * Letter _i_ is on the field over `[spawn_i, spawn_i + fall_i)` and letter
 * _i+1_ spawns at `spawn_i + gap_{i+1}`, so the two share the screen exactly
 * when `gap_{i+1} < fall_i`. If every gap a spec can draw is at least every
 * fall it can draw — `gap[0] ≥ fall[1]` — that is never true, and since spawn
 * times only increase, no *later* letter can overlap letter _i_ either. So the
 * early levels' "never more than one on screen" is a property of the spec, not
 * a hope about the draw.
 *
 * The boundary goes to safety: `gap` exactly equal to `fall` still leaves one
 * letter on screen, because the interval is half-open — the outgoing letter
 * lands on the same millisecond the next one spawns, and landing is the tick
 * that takes it off the field.
 */
export function buildWave(spec: WaveSpec, seed: number): Wave {
  const rand = mulberry32(seed);

  // Filtered once, up front. An empty pool — a spec naming only characters
  // this board cannot type — yields an empty wave rather than an exception:
  // the engine's habit is that a mode which no longer makes sense still opens
  // (`deckSpec` never throws), and a storm with nothing in it is a screen that
  // ends, where a throw is a game loop that dies holding a child's run.
  const pool = spec.keys
    .map(fallable)
    .filter((entry): entry is Fallable => entry !== null);

  const letters: StormLetter[] = [];
  let spawnMs = 0;
  for (let i = 0; i < spec.count && pool.length > 0; i++) {
    // The gap is the time since the previous spawn, so the first letter has
    // none — the wave starts with it. Not sampled-and-discarded for i = 0,
    // because a draw nobody uses is still part of what the seed means.
    if (i > 0) spawnMs += between(spec.gap[0], spec.gap[1], rand);
    const from = pool[between(0, pool.length - 1, rand)];
    const fallMs = between(spec.fall[0], spec.fall[1], rand);
    letters.push({ ...from, spawnMs, fallMs, landMs: spawnMs + fallMs });
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
 * Everything below is a pure function of the state it is handed. No clock, no
 * `Math.random`, no DOM, no React — the loop reads a real clock, calls `tick`
 * with the delta and writes transforms; the tests call the same two functions
 * with numbers. "Did that letter get through" is therefore a question that can
 * be asked without a browser, which is the only reason the shield's rules are
 * testable at all.
 */

/**
 * Is this letter on the field at `timeMs`?
 *
 * A letter occupies the **half-open** interval `[spawnMs, landMs)`: there the
 * instant it spawns, gone the instant it lands, because landing is the tick
 * that turns it into shield damage (decision 30).
 *
 * That convention is exported as a pair of predicates rather than written out
 * where it is needed, because it is one `<` against one `<=` and more than one
 * thing reads it: `targetIndex` decides what can be shot with `isAirborne`,
 * `tick` decides what damages the shield with `hasLanded`, and the field will
 * draw whatever `isAirborne` says is there (STM03). Spelled out at each of
 * those, it would be three chances to pick the wrong side of a millisecond —
 * and the wrong side of a millisecond is a letter that is both shootable and
 * already spent.
 *
 * `hasLanded` is deliberately not `!isAirborne`: a letter that has not spawned
 * yet is neither on the field nor landed, and the reducer must not charge the
 * shield for a letter that has not fallen.
 */
export function isAirborne(letter: StormLetter, timeMs: number): boolean {
  return letter.spawnMs <= timeMs && timeMs < letter.landMs;
}

/** Has this letter reached the shield by `timeMs`? See `isAirborne`. */
export function hasLanded(letter: StormLetter, timeMs: number): boolean {
  return letter.landMs <= timeMs;
}

/**
 * How far down the field a letter is at `timeMs`: 0 at the top, 1 at the shield.
 *
 * One function rather than an expression repeated wherever it is wanted,
 * because two of its readers must agree exactly: the renderer writes it into a
 * `translateY` (STM03) and `targetIndex` takes the maximum of it to decide
 * what the gun is aimed at. A child aims by looking, so the letter the game
 * thinks is lowest has to be the letter that is drawn lowest.
 *
 * `fallMs` cannot be 0 while a letter is airborne — `spawn <= t < spawn +
 * fall` has no solutions at `fall = 0` — so the division is safe everywhere
 * the value is a position. Off the interval it still answers, and answers
 * honestly: negative before the spawn, past 1 after the landing.
 */
export function progressAt(letter: StormLetter, timeMs: number): number {
  return (timeMs - letter.spawnMs) / letter.fallMs;
}

/**
 * The eight shield segments, in board order — left pinky to right pinky.
 *
 * An order rather than a set, because two things need it to be the *same*
 * order: the shield is drawn as eight segments across the bottom of the field
 * (STM03), and a repair has to break a tie between equally weak zones somehow.
 * Using the order the child is looking at means the tie-break is at least a
 * thing they could watch happen, rather than whatever order a `Record`'s keys
 * came out in.
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
 * `atMs` is wave time — the instant of the press for a letter that was shot,
 * and the letter's own `landMs` for one that got through. Its own landing and
 * not the tick that noticed it, because a tick can arrive several landings
 * late (see `tick`), and STM08 turns this into a `CardResult.ms` of
 * `atMs - spawnMs` (§8.7). A card that timed a backgrounded tab instead of a
 * fall would put a nonsense number in a child's record book for ever.
 *
 * `combo` is the streak the shot left the run on — the number the HUD draws
 * its multiplier from the instant after it — and 0 for a letter that got
 * through, since a landing is what breaks a streak. It is recorded rather than recovered
 * because it cannot be recovered: a wrong key breaks the combo and resolves no
 * letter, so nothing in `resolved` remembers that it happened, and a run's XP
 * counted back off this array without it would pay a child for a streak they
 * did not keep. `stormXp` folds exactly this pair — `atMs - spawnMs` and
 * `combo` — through `cardXp` when the run is over (§8.6).
 */
export type LetterOutcome = {
  outcome: "shot" | "landed";
  atMs: number;
  combo: number;
};

/**
 * How a run finished, or `null` while it is still going.
 *
 * `breached` carries the finger rather than leaving it to be looked up later.
 * Naming the finger that failed is the best thing this game tells a child
 * (§8.5), and it must be the finger the letter actually fell on — so it is
 * copied from the letter at the moment it got through, not re-derived from a
 * shield that by then reads the same at several zones. `index` is the letter
 * that ended it: what the death screen can show, and where its drill starts.
 */
export type StormEnding =
  | { kind: "cleared" }
  | { kind: "breached"; finger: ShieldFinger; index: number };

/**
 * A run, mid-storm.
 *
 * Everything here is a fact that cannot be recovered from the wave and the
 * clock, and nothing here is a fact that can. There is no list of letters on
 * screen, no cached lowest letter and no per-finger tally of what got through:
 * the first two are `isAirborne` and `targetIndex` over a schedule that was
 * decided before the run started, and the third is a `filter` over `resolved`
 * that the death screen can do for itself. A second copy of any of them would
 * be a second thing to keep in step sixty times a second, and the copy is
 * always the one that ends up lying.
 *
 * `resolved` is parallel to `wave.letters` and indexed by the letter's
 * identity (§8.3). Indexed rather than appended to, because resolution is
 * **not** in spawn order: shoot the middle one of three and the array gets a
 * hole in it. That indexing is also what makes the run a `Session` later with
 * no bookkeeping — card _i_ is letter _i_, so `prompt`, `answer` and `factId`
 * are its character and `ms` is `atMs - spawnMs` (§8.7, STM08).
 *
 * What the next story adds, and why nothing here is in its way: STM07 reads
 * `ending` for the finger and counts `resolved` by finger for "let three
 * through". It wants no different shape.
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
   * It is state and not a view's counter because a rule reads it: every
   * `repairAt` of them puts a point back into the weakest zone (§8.5), which
   * is the game's only comeback path and pays out for exactly the behaviour it
   * exists to build. A letter that landed breaks the streak as surely as a
   * wrong key does — the streak means "are you keeping up", and a letter you
   * let through is the definition of not keeping up.
   *
   * The score multiplier hangs on this same number, through the same
   * `comboMultiplier` a race pays its cards at — so a child sees ONE streak,
   * and the ×1.6 in the HUD is the ×1.6 their XP is worth (§8.6).
   */
  readonly combo: number;
  /**
   * The run's own score. Starts at 0, and **may go negative** (§8.6).
   *
   * Kept rather than derived because it cannot be derived: a wrong key costs
   * points and resolves no letter, so `resolved` has no record of it, and the
   * multiplier a hit was paid at is history the moment the streak moves on.
   *
   * It is not XP and it never becomes XP. `stormXp` is computed once at the
   * end, from the hits alone and floored at zero, precisely so that this
   * number is free to fall (see `progress.ts`).
   */
  readonly score: number;
  /**
   * Wrong keys — shots that hit nothing, including shots at an empty sky.
   *
   * A count and not a list, because the two things that read it want a number:
   * the HUD mounts one `--flare` flash per miss off it (a counter that only
   * goes up cannot restart an animation, §8.10, decision 42), and STM08 owes a
   * saved session an `incorrect` that counts what a child got wrong rather
   * than only what the shield paid for.
   */
  readonly misses: number;
  /** How the run finished, or `null` while it is live. */
  readonly ending: StormEnding | null;
};

/**
 * What a clean hit is worth before the combo multiplier, and what a wrong key
 * costs (§8.6).
 *
 * Equal, and that is the whole of the balance: **one wrong key undoes one
 * plain hit**, which is a sentence a five-year-old can hold on to. A hit on a
 * long streak is worth two of them (×2 at ten in a row), so keeping a run
 * clean pays for itself twice over — once in the multiplier, and once in the
 * misses it did not make.
 *
 * A letter that gets through costs neither. It has already cost a shield
 * point, which is the thing that ends runs, and charging for it twice would
 * make the number that goes down mean two different failures at once
 * (decision 46).
 */
export const HIT_POINTS = 10;
export const MISS_POINTS = 10;

/**
 * Stamp `cleared` on a state whose last letter has just been accounted for.
 *
 * Cleared is "every letter resolved" rather than "the clock passed
 * `durationMs`", because shooting the last letter ends the wave there and
 * then; the alternative leaves a child watching an empty field for the second
 * and a half that letter would have taken to fall. The two agree wherever it
 * matters — a letter is only ever resolved by being shot or by landing, and
 * nothing can land after `durationMs`.
 */
const settled = (state: StormState): StormState =>
  state.ending !== null || state.resolved.some((outcome) => outcome === null)
    ? state
    : { ...state, ending: { kind: "cleared" } };

/**
 * A run at time zero: full shield, nothing resolved, no streak.
 *
 * The wave is carried, not copied. The retry button, the results screen and
 * the reducer are all meant to be looking at the same storm, and a state that
 * owned its own copy of the schedule would be a second place for it to be
 * wrong.
 *
 * An empty wave is born `cleared` — the same habit as `buildWave` not throwing
 * (§8.3). A storm with nothing in it is a screen that ends, where a loop
 * waiting on a letter that will never spawn is a run a child cannot leave.
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
    ending: null,
  });
}

/**
 * The lowest letter on the field, as an index into `wave.letters` — or `null`
 * if nothing is falling.
 *
 * **Lowest is the greatest `progressAt`, and not the earliest `landMs`.** The
 * two orderings look interchangeable and are not: every letter draws its own
 * fall time, so a fast letter spawned second genuinely overtakes a slow one
 * spawned first, and from the crossing until the landing the two orderings
 * disagree about which is nearer the shield. Aiming by `landMs` would point
 * the gun at a letter that is visibly higher up the screen — and the child is
 * looking at the field, not at the schedule.
 *
 * On an exact tie — two letters at the same height, which is the single
 * instant their lines cross — the lower index wins, which is the earlier
 * spawn. Neither is fairer to a child who cannot see a difference between
 * them, so the tie goes to the thing that is already a letter's identity
 * (§8.3): the same wave replayed resolves the same dead heat the same way. A
 * replay that diverged on a rounding difference would be a worse bug than
 * either answer to the tie.
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
 * The shield after a hit, with `repairAt` applied.
 *
 * The weakest zone rather than the last one damaged, because a hole is what
 * ends a run: the segment at zero is simultaneously the one about to kill you
 * and the one a single point is worth most in. "Weakest" picks it with no
 * special case for holes at all.
 *
 * Two edges, both deliberate:
 *
 *   - **`repairAt: 0` disables repairs**, as `WaveSpec` declares — said out
 *     loud rather than left to `combo % 0` being `NaN`. The arithmetic does
 *     fall the right way on its own, which is the problem: the rule the spec
 *     writes down would be an accident of IEEE, and the same expression hands
 *     a *negative* `repairAt` a repair every other hit.
 *   - **No zone ever exceeds `spec.shield`.** A wave whose repairs outran its
 *     damage would hand a strong player a shield deeper than the level ever
 *     wrote down, and the eight-of-`shield` a run starts with is exactly what
 *     "the shield came through untouched" is reported against. At the cap the
 *     repair is spent rather than banked — banking it would be a hit point
 *     arriving at a moment nothing on screen explains.
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
 * ── A tick may be arbitrarily long ───────────────────────────────────────────
 * `dtMs` is whatever the loop hands over, and a backgrounded tab hands over
 * seconds: `requestAnimationFrame` stops, the child comes back, and a dozen
 * letters are due at once. Every landing inside the interval is resolved, in
 * the order it happened — including letters that spawned *and* landed inside
 * the same tick and were never airborne at any instant anybody sampled.
 * Dropping those would leave the shield quietly disagreeing with the storm
 * that damaged it, and the disagreement would be invisible: the letters are
 * gone from the screen either way.
 *
 * Whether a child should be *held responsible* for a tab they were not looking
 * at is a different question, and it belongs to the clock (STM03): clamping
 * the delta, or pausing on `visibilitychange`, is a decision the loop can only
 * make deliberately because the rules underneath it are honest about the whole
 * interval they were given. Two things that loop cannot lean on: a `NaN` delta
 * poisons `timeMs` for the rest of the run and ends nothing — no delta between
 * two real clock readings is one, and clamping is STM03's — and neither a tick
 * with no landing nor a missed `fire` returns the object it was handed, so
 * identity is not a "nothing changed" signal.
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
    // was shot on no streak at all, and `stormXp` pays nothing for it either
    // way — it looks only at what was shot.
    resolved[index] = { outcome: "landed", atMs: letter.landMs, combo: 0 };
    combo = 0;

    if (shield[letter.finger] <= 0) {
      // The zone above it is a hole, so there is nothing left to take the hit
      // and the storm is through. The clock stops at that landing rather than
      // at the end of the tick: the rest of this interval never happened, and
      // the letters still due inside it stay unresolved rather than being
      // charged to a shield the child no longer had. That includes a letter
      // tying this exact `landMs` from a higher index, which `hasLanded` now
      // reads true of — so "got through" (STM07) counts `resolved`, never
      // `hasLanded`.
      ending = { kind: "breached", finger: letter.finger, index };
      clock = letter.landMs;
      break;
    }

    shield[letter.finger] -= 1;
  }

  return settled({ ...state, timeMs: clock, shield, resolved, combo, ending });
}

/**
 * Fire at the lowest letter on screen. Anything else is a miss.
 *
 * ── Why only the lowest ──────────────────────────────────────────────────────
 * The alternative is not "let the second letter count too"; it is a game with
 * no wrong answer in it. If any letter on screen can be shot by its own key,
 * the winning strategy is to hammer every key the wave draws from and let the
 * matches happen — and the child doing that is practising nothing at all while
 * the score congratulates them for it. Firing has to be able to be *wrong*
 * before hitting can mean anything, and the only sense of "wrong" a
 * falling-letter game can defend is out of order: the bottom letter is the one
 * nearest the shield *on screen*, which is the one a child can see is most
 * urgent and can aim at without knowing anything the field is not showing
 * them.
 *
 * Nearest is not soonest. Letters fall at different speeds, so the letter due
 * to land first may be a different one, visibly higher up the screen, from the
 * moment two paths cross until one of them lands (decision 32, and
 * `targetIndex`). The rule follows the field and not the schedule on purpose:
 * a target picked by `landMs` would refuse the letter the child is watching
 * drop and demand one they have no way to know was closer in time.
 *
 * That is also what makes the difference between one letter in the air and
 * three a difference in kind. With one, target and only letter are the same
 * thing and the game is pure reaction. With three, taking the bottom one first
 * is an act of prioritising under time pressure — reading ahead, which is the
 * thing that separates a typist from a hunter — and it is a skill precisely
 * because getting the order wrong costs something: the streak, and with it the
 * multiplier every later hit would have been paid at, plus `MISS_POINTS` off
 * the score there and then.
 *
 * A shot at an empty field is a miss for the same reason. It is exactly the
 * spray this rule exists to make unprofitable, and a child who could keep
 * their streak through it has found the strategy again by another route. The
 * screen owes them an answer to it that the board can tell the truth with:
 * a stroke that costs points must not light `--lime` for "that was right", so
 * the keyboard flares every key while the gun is live and has no target
 * (`StormField`, decision 43).
 */
export function fire(state: StormState, code: string): StormState {
  if (state.ending !== null) return state;

  // Compared by `code` and not by the character: a shifted legend and its base
  // share a key, so `A` and `a` are both `KeyA` and the shift a child is
  // holding cannot make the shot miss (decision 2).
  const index = targetIndex(state);
  if (index === null || state.wave.letters[index].code !== code)
    // A miss: the streak, the score and a mark against the run. Nothing on the
    // field moves — the letter the child should have shot is still falling,
    // which is the other half of the cost.
    return {
      ...state,
      combo: 0,
      score: state.score - MISS_POINTS,
      misses: state.misses + 1,
    };

  const resolved = state.resolved.slice();
  const combo = state.combo + 1;
  resolved[index] = { outcome: "shot", atMs: state.timeMs, combo };

  return settled({
    ...state,
    resolved,
    combo,
    // Paid at the multiplier the hit LANDS on, not the one before it: the
    // fifth hit in a row is worth ×1.5, and it is the number the HUD is
    // already showing by the time a child looks at it. Same convention as
    // `cardXp(ms, streakAfter)`, which is what pays the same hit in XP —
    // one streak, one multiplier, two currencies (§8.6).
    score: state.score + Math.round(HIT_POINTS * comboMultiplier(combo)),
    shield: repaired(state.shield, state.wave.spec, combo),
  });
}

/* ═══ What a run came to (§8.5, §8.7) ════════════════════════════════════════
 *
 * The screen a child meets when the storm stops asks a handful of questions
 * the reducer can already answer, and one it cannot. Which finger let it
 * through, how many that finger let through, what that finger's keys are, how
 * much armour is left and how long the best streak ran are all `state` — so
 * they are decided here, and the screen puts them on a page. What is NOT here
 * is XP: `stormXp` lives in `progress.ts`, which reaches `decks/index.ts`, and
 * this module is one hop from the deck layer from STM10 onwards (see the file
 * header).
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
 * `hit` is a filter over `resolved` — the tally `StormState` deliberately does
 * not keep, because a second copy of it is a second thing to hold in step
 * sixty times a second.
 *
 * **`resolved`, and never `hasLanded`.** After a breach the clock stops at the
 * fatal `landMs` rather than at the end of the tick that found it, so a letter
 * from a higher index tying that exact millisecond is left unresolved while
 * `hasLanded(letter, state.timeMs)` reads true of it. Counting the clock
 * instead of the outcomes would over-report what got through, on the one
 * screen where that number is the whole point (`tick`, and STM07's ending).
 *
 * `mend` is arithmetic over the same: a zone's hit points are
 * `spec.shield - absorbed + repairs` by construction, so solving for repairs
 * needs nothing that is not already on screen. **Absorbed, not landed**: the
 * letter that ends a run lands on a zone that is already at nothing and takes
 * no point off it (`tick` breaks before the decrement), so counting it would
 * read as a phantom repair on the frame a child dies. It still tints — it is
 * the loudest thing that ever gets through — which is why the two counters are
 * separate rather than one.
 *
 * Here beside the reducer rather than in the shield that draws it, because it
 * is the same arithmetic the ending screen names a finger with: "your right
 * ring finger let three through" is `hit` on one zone, and two files working
 * it out separately is two chances to count a landing differently.
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
 * and a punishment. A zone covers four rows of keys, and a child who has just
 * died at lesson 13 has met exactly one of the right ring finger's — `l`.
 * Handing them `o`, `.`, `9` and `(` as well, because the plastic says those
 * are that finger's, would be a practice deck of keys nobody has taught them.
 * The wave's own pool is exactly "what this level draws from", so the drill is
 * the keys they were being asked for and missed.
 *
 * It can never come back empty for a finger that has just breached: the letter
 * that got through came out of this same pool wearing this same finger.
 *
 * Filtered through `fallable`, so this and the wave agree by construction
 * about which finger types what — including the two kinds of character a wave
 * drops silently: the ones this board cannot produce, and the thumb's.
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
 * Recovered from `resolved` rather than kept on the run, for the reason
 * everything else about a finished storm is: `LetterOutcome.combo` is the
 * streak each hit landed on and a streak only ever climbs by one, so the
 * largest of them IS the longest run of clean hits. A `bestCombo` field on
 * `StormState` would be a second number to move on every hit and a second
 * thing to get wrong in `fire`.
 *
 * Zero for a run that never hit anything, which is the same zero a run that
 * never started has — and the right answer to both.
 */
export function bestCombo(state: StormState): number {
  return state.resolved.reduce<number>(
    (best, outcome) =>
      outcome?.outcome === "shot" ? Math.max(best, outcome.combo) : best,
    0,
  );
}

/**
 * Everything the ending screen says, decided (§8.5, STM07).
 *
 * `null` while the run is live, so a screen cannot draw an ending that has not
 * happened: the one call answers "is it over" and "what happened" together,
 * where two would let a caller ask the second without the first.
 *
 * The screen holds no rules at all, and this is the list of them it would
 * otherwise have had to hold: which finger failed, how many it let through,
 * which keys to practise, and how much of the shield came through. Same
 * division as the loop and `tick` — the picture is the view's, the arithmetic
 * is the model's (§8.9).
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
   * never hit. Zero is what "the shield came through untouched" is (§8.5).
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
