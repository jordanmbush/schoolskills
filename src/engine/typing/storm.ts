/**
 * Hailstorm's rules. This half of them is the wave: what falls, where, and when
 * (docs/typing.md §8.3).
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
 * the spec, the RNG, and the keyboard: the characters a wave draws from arrive
 * as `spec.keys`, from a caller that already knows them.
 */
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
   * and part company exactly where it matters are worth a sentence.
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
