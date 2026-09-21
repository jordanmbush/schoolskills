/**
 * The bench: pick a sheet, tune it, watch the page change, print it.
 *
 * One rail and one idea. Across the top, everything that changes the paper,
 * one section at a time in a tray under the rail; under that, the paper, as
 * wide as the screen allows. There is no preview button and no "apply",
 * because there is nothing to apply to: `buildWith(spec, config, seed)` is a
 * pure function of the state this island holds, so the sheet is not a
 * rendering of the settings, it *is* them.
 *
 * Why an island can keep the site's chrome around it here, where a race cannot,
 * is in make.astro.
 */
import { useMemo, useRef, useState } from "react";

import { buildWith, keyWith } from "@/engine/sheets/spec";
import type { Sheet, SheetConfig } from "@/engine/sheets/types";
import "@/styles/printshop.css";

import { Caption } from "./Caption";
import { Chooser } from "./Chooser";
import { FamilyOptions } from "./options";
import {
  AnswerBoxes,
  HeadingOptions,
  LetteringOptions,
  PaperOptions,
} from "./PageOptions";
import { Preview, PrintCopy } from "./Preview";
import { Rail, TRAY_ID, useUnderMasthead, type Section } from "./Rail";
import { SavedSheets } from "./SavedSheets";
import { FIRST_SHEET } from "./defaults";
import { labelOf, tabOf } from "./shelves";
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

/** The tray a sheet lands in when it arrives: its own options, if it has any. */
const landing = (kind: string): Section | null =>
  tabOf(kind) ? "family" : null;

function Bench({ opening }: { opening: SharedSheet | null }) {
  const bench = useBuilder(opening);
  const [open, setOpen] = useState<Section | null>(() =>
    landing(bench.config.kind),
  );
  const rail = useRef<HTMLDivElement>(null);
  useUnderMasthead(rail);

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

  // Two families, and the second is not a slip. The chooser names the one being
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

  const toggle = (section: Section) =>
    setOpen((current) => (current === section ? null : section));

  // A sheet chosen or opened lands on its own options, whichever door it came
  // through: that is where the next question is.
  const choose = (kind: string) => {
    bench.setFamily(kind);
    setOpen(landing(kind));
  };
  const openSheet = (config: SheetConfig, seed: number) => {
    bench.open(config, seed);
    setOpen(landing(config.kind));
  };

  const panel = { config: bench.config, set: bench.set };

  return (
    <div className="bench">
      <div className="bench__rail no-print" ref={rail}>
        <Rail
          sheet={labelOf(bench.config.kind)}
          tab={tabOf(bench.config.kind)}
          open={open}
          onToggle={toggle}
          variants={bench.variants}
          answers={bench.answers}
          onVariants={bench.setVariants}
          onAnswers={bench.setAnswers}
        />
        <div className="tray" id={TRAY_ID} hidden={open === null}>
          {open === "sheet" && (
            <Chooser
              kind={bench.config.kind}
              onFamily={choose}
              onOpen={openSheet}
            />
          )}
          {open === "family" && (
            <div className="tray__grid wrap">
              <FamilyOptions {...panel} />
              <AnswerBoxes {...panel} />
            </div>
          )}
          {open === "paper" && (
            <div className="tray__grid wrap">
              <PaperOptions {...panel} />
            </div>
          )}
          {open === "lettering" && (
            <div className="tray__grid tray__grid--wide wrap">
              <LetteringOptions {...panel} />
            </div>
          )}
          {open === "heading" && (
            <div className="tray__grid tray__grid--wide wrap">
              <HeadingOptions {...panel} />
            </div>
          )}
          {open === "mine" && (
            <SavedSheets
              config={bench.config}
              seed={bench.seed}
              onOpen={openSheet}
            />
          )}
        </div>
      </div>

      {/* `.no-print` on the frame and not only on the two things inside it:
          both children already carry it, but a frame emptied by `display: none`
          on its contents still has its padding, and the print copy below would
          lay out under it rather than at the top of the paper. */}
      <div className="bench__paper wrap no-print">
        <Preview sheets={sheets} />
        <Caption
          line={chosen ? chosen.describe(bench.config) : ""}
          seed={bench.seed}
          onReroll={bench.reroll}
        />
      </div>

      <PrintCopy sheets={sheets} />
    </div>
  );
}
