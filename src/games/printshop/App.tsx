/**
 * The bench: pick a sheet, tune it, watch the page change, print it.
 *
 * Two columns and one idea. On the left, every option that changes the paper;
 * on the right, the paper. There is no preview button and no "apply", because
 * there is nothing to apply to: `buildWith(spec, config, seed)` is a pure
 * function of the state this island holds, so the sheet on the right is not a
 * rendering of the settings on the left, it *is* them.
 *
 * Why an island can keep the site's chrome around it here, where a race cannot,
 * is in make.astro.
 */
import { useMemo, useState } from "react";

import { buildWith, keyWith } from "@/engine/sheets/spec";
import type { Sheet } from "@/engine/sheets/types";
import "@/styles/printshop.css";

import { Bootstrap } from "./Bootstrap";
import { FamilyOptions } from "./options";
import { PageOptions } from "./PageOptions";
import { Picker } from "./Picker";
import { Preview, PrintCopy } from "./Preview";
import { PrintBar } from "./PrintBar";
import { SavedSheets } from "./SavedSheets";
import { FIRST_SHEET } from "./defaults";
import {
  openingSheet,
  useBuilder,
  useDebounced,
  type SharedSheet,
} from "./useBuilder";
import { useFamily } from "./useFamily";

/**
 * The wait for the family the bench opens on, and nothing else.
 *
 * A family is a chunk of its own now (§3), and the bench builds paper as it
 * mounts — `useBuilder` test-builds whatever the fragment held before it trusts
 * it — so there is nothing to render until that one module is here. Every
 * family chosen afterwards is fetched underneath a bench that stays on screen.
 */
export default function PrintShopApp() {
  const [opening] = useState(openingSheet);
  const first = useFamily(opening?.config.kind ?? FIRST_SHEET);

  return first ? <Bench opening={opening} /> : null;
}

function Bench({ opening }: { opening: SharedSheet | null }) {
  const bench = useBuilder(opening);

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

  const settled = useDebounced(live);

  // Two families, and the second is not a slip. The picker names the one being
  // chosen and the press builds the one that has settled, which are the same
  // family except in the moment after a switch — and that is exactly when the
  // difference pays, because asking for the live one starts its download while
  // the preview is still holding the old sheet.
  const chosen = useFamily(bench.config.kind);
  const printing = useFamily(settled.config.kind);

  const sheets = useMemo<Sheet[]>(() => {
    if (!printing) return [];
    const pages: Sheet[] = [];
    for (let copy = 0; copy < settled.variants; copy++) {
      // Variants are `seed + n` and nothing more elaborate (§7), so each one is
      // reproducible from the number printed at the foot of the page.
      const seed = settled.seed + copy;
      pages.push(buildWith(printing, settled.config, seed));
      if (settled.answers) pages.push(keyWith(printing, settled.config, seed));
    }
    return pages;
  }, [printing, settled]);

  return (
    <div className="bench">
      <div className="bench__panel no-print">
        {/* Above the picker, because it answers the question the picker asks: a
            parent who came to print what their child keeps missing should not
            have to work out which family that is. It only ever opens a sheet on
            the bench — everything below stays in charge of it afterwards. */}
        <Bootstrap onOpen={bench.open} />

        <Picker
          config={bench.config}
          spec={chosen}
          onFamily={bench.setFamily}
        />

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
