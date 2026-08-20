import type { LadderProgress } from "@/engine/typing/ladder";
import { LESSONS, type Lesson } from "@/engine/typing/lessons";
import { STORM_NOTE, LessonTile } from "./LessonTile";

/**
 * The hundred lessons, as the ice world's own overworld (docs/typing.md §9).
 *
 * Ten rows of ten with the blocks named down the side, because that is what
 * turns a syllabus into a map: a child can see the whole course, see the two
 * rows they have finished, and see that the row they are on ends in a
 * checkpoint. A list of a hundred titles is the same data and none of that.
 *
 * Everything on it is **derived** — `LESSONS` for the shape of the ladder and
 * `ladderProgress` for where this child is on it (§6.5). There is no stored
 * "unlocked" flag anywhere behind this screen, which is why re-tuning a
 * lesson's criteria re-draws the map for every child with no backfill.
 *
 * Choosing a tile opens the lesson's brief (§9, #145) — what it teaches, the
 * three bars it wants, your best, and how much of the keyboard will be on
 * screen. The tile is the door and the brief is what is written on it, which
 * is why a locked tile still says what would open it: a lesson that turns out
 * to be too hard costs a child nothing but the run (§6.6), and one they cannot
 * reach yet should at least say so.
 */

/**
 * The ten blocks by name (§5.5), in the order the ladder walks them.
 *
 * The same names `lessons.ts` carries as section comments over its own table,
 * because a block is a stretch of that table and the two would look wrong side
 * by side if they disagreed. Written here rather than in the engine on
 * purpose: `lessons.ts` is imported by `decks/index.ts`, which is the front
 * door for every island on the site (§5.3), and a label only this screen draws
 * has no business being shipped to the flash cards.
 */
const BLOCK_NAMES = [
  "Home row",
  "Reaching up",
  "Reaching down",
  "Capitals",
  "Fluency",
  "Numbers",
  "Punctuation",
  "Endurance",
  "Speed",
  "Everything",
];

/**
 * The ladder cut into its blocks, once, at module load.
 *
 * Grouped off `lesson.block` rather than sliced ten at a time: the block is
 * data on the lesson, and a `slice(0, 10)` would be a second opinion about
 * where a block ends that quietly disagrees the day the ladder is re-cut.
 */
const BLOCKS = BLOCK_NAMES.map((name, i) => ({
  n: i + 1,
  name,
  lessons: LESSONS.filter((lesson) => lesson.block === i + 1),
}));

export function LessonLadder({
  progress,
  hasKeyboard,
  onOpen,
}: {
  progress: LadderProgress;
  /**
   * Whether this device looks like it has a physical keyboard
   * (`useKeyboardPresence`), which decides what the Hailstorm tiles say
   * (§8.8).
   *
   * A prop rather than a hook call in here, so this screen stays a pure
   * function of what it is handed — the same reason `progress` arrives as one.
   * `TypingSetup` is where the browser is asked.
   */
  hasKeyboard: boolean;
  onOpen: (lesson: Lesson) => void;
}) {
  return (
    <section className="panel ladder anim-rise">
      <div className="panel__head">
        <h2 className="panel__title">Frost Keys</h2>
        <span className="chip u-mono">
          {progress.cleared.size}/{LESSONS.length}
        </span>
      </div>

      {/* The rule of the ladder in two sentences, and the second is the one
          that matters: the express lane is invisible unless it is said. A
          child who can already type has no reason to guess that the tile forty
          rungs up is one they are allowed to press (§6.6, decision 16). */}
      <p className="muted ladder__lede">
        A hundred lessons, ten to a block. Pass one and the next opens — and
        every checkpoint is open from the start, so if you can already type, try
        one. Getting it wrong costs you nothing.
      </p>

      <ol className="ladder__blocks">
        {BLOCKS.map((block) => (
          <li key={block.n} className="ladder__block">
            {/* A heading rather than a caption, so the ten blocks are ten
                stops for anyone moving through the page by heading — which is
                how a hundred tiles stay navigable without a skip link. */}
            <h3 className="ladder__name">
              <span className="ladder__blocknum u-mono">{block.n}</span>
              {block.name}
            </h3>
            <ol className="ladder__row">
              {block.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <LessonTile
                    lesson={lesson}
                    progress={progress}
                    hasKeyboard={hasKeyboard}
                    onOpen={onOpen}
                  />
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      {/* The legend says what the shapes mean, because the shapes are the only
          place two of these facts are written. Each swatch is scenery — the
          words carry it, and every tile says its own state out loud. */}
      <ul className="ladder__key">
        <li className="ladder__keyitem">
          <span className="ladder__tile is-cleared" aria-hidden="true" />
          Passed
        </li>
        <li className="ladder__keyitem">
          <span className="ladder__tile is-next" aria-hidden="true" />
          Start here
        </li>
        <li className="ladder__keyitem">
          <span
            className="ladder__tile is-open is-checkpoint"
            aria-hidden="true"
          />
          Checkpoint — open from the start, whatever you have passed
        </li>
        <li className="ladder__keyitem">
          <span className="ladder__tile is-open is-storm" aria-hidden="true" />
          {/* The one place the keyboard is explained rather than merely
              enforced, and the one place the way out of a wrong guess is
              offered (§8.8, #155). It is said once, here, because a hundred
              tiles each carrying "press any key" is wallpaper rather than
              advice — and it corrects itself the instant a key is pressed,
              with nothing to reload. */}
          {hasKeyboard
            ? `${STORM_NOTE} Coming soon`
            : `${STORM_NOTE} It needs a keyboard, so these stay shut here. Press any key if you have one`}
        </li>
      </ul>
    </section>
  );
}
