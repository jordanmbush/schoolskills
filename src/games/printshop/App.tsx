/**
 * The bench: pick a sheet, tune it, watch the page change, print it.
 *
 * A `client:only` island inside a real page, which is the opposite arrangement
 * from the two games. A race must never have site chrome over it; the builder
 * keeps the masthead and the footer because `print.css` hides them at exactly
 * the moment they would cost somebody toner — see the note in make.astro.
 *
 * The screen is two columns and one idea. On the left, every option that
 * changes the paper; on the right, the paper. There is no preview button and no
 * "apply", because there is nothing to apply to: `buildSheet(config, seed)` is a
 * pure function of the state this island holds, so the sheet on the right is not
 * a rendering of the settings on the left, it *is* them.
 *
 * Nothing here reaches for storage. The saved-sheet panel calls
 * `services/sheets`, the URL is written by `useBuilder`, and this module only
 * decides what goes where.
 */
import { useMemo } from "react";

import { answerKey, buildSheet } from "@/engine/sheets";
import type { Sheet } from "@/engine/sheets/types";
import "@/styles/printshop.css";

import { Bootstrap } from "./Bootstrap";
import { FamilyOptions } from "./options";
import { PageOptions } from "./PageOptions";
import { Picker } from "./Picker";
import { Preview, PrintCopy } from "./Preview";
import { PrintBar } from "./PrintBar";
import { SavedSheets } from "./SavedSheets";
import { useBuilder, useDebounced } from "./useBuilder";

export default function PrintShopApp() {
  const bench = useBuilder();

  // Memoised so the debounce below has something stable to hold. Without it
  // every render would make a new object, the timer would restart on the render
  // the timer itself caused, and the preview would rebuild forever.
  const live = useMemo(
    () => ({
      config: bench.config,
      seed: bench.seed,
      variants: bench.variants,
      answers: bench.answers,
    }),
    [bench.config, bench.seed, bench.variants, bench.answers],
  );

  // The controls are never debounced — a stepper that answered a sixth of a
  // second late would feel broken. Only the paper is.
  const settled = useDebounced(live);

  const sheets = useMemo<Sheet[]>(() => {
    const pages: Sheet[] = [];
    for (let copy = 0; copy < settled.variants; copy++) {
      // Variants are `seed + n` and nothing more elaborate (§7): the same
      // settings, a different draw, and each one reproducible from the number
      // printed at the foot of the page.
      const seed = settled.seed + copy;
      pages.push(buildSheet(settled.config, seed));
      if (settled.answers) pages.push(answerKey(settled.config, seed));
    }
    return pages;
  }, [settled]);

  return (
    <div className="bench">
      <div className="bench__panel no-print">
        {/* Above the picker, because it answers the question the picker asks:
            a parent who came to print what their child keeps missing should not
            have to work out which family that is. It only ever opens a sheet on
            the bench — everything below stays in charge of it afterwards. */}
        <Bootstrap onOpen={bench.open} />

        <Picker config={bench.config} onFamily={bench.setFamily} />

        <section className="bench__group">
          <h2 className="bench__title u-display">What is on it</h2>
          <FamilyOptions config={bench.config} set={bench.set} />
        </section>

        <section className="bench__group">
          <h2 className="bench__title u-display">The page</h2>
          <PageOptions config={bench.config} set={bench.set} />
        </section>

        <SavedSheets
          config={bench.config}
          seed={bench.seed}
          onOpen={bench.open}
        />
      </div>

      {/* `.no-print` on the column and not only on the two things inside it:
          both children already carry it, but a bench column emptied by
          `display: none` on its contents is still a column, and the print copy
          below would lay out under it rather than at the top of the paper. */}
      <div className="bench__paper no-print">
        <PrintBar
          seed={bench.seed}
          variants={bench.variants}
          answers={bench.answers}
          onVariants={bench.setVariants}
          onAnswers={bench.setAnswers}
          onReroll={bench.reroll}
        />
        <Preview sheets={sheets} />
      </div>

      <PrintCopy sheets={sheets} />
    </div>
  );
}
