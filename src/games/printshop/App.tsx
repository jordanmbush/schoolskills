/**
 * The bench: pick a sheet, tune it, watch the page change, print it.
 *
 * One rail and one idea. Across the top, everything that changes the paper as
 * numbered steps, one open at a time in a tray under the rail; under that, the
 * paper, as wide as the screen allows. There is no preview button and no
 * "apply", because there is nothing to apply to: `buildWith(spec, config,
 * seed)` is a pure function of the state this island holds, so the sheet is
 * not a rendering of the settings, it *is* them.
 *
 * The steps have an order and no gate. Every one holds a good value from the
 * first second, so a parent who only ever presses "Next" walks the order and
 * ends at Print, and one who knows what they want opens any step directly
 * (§14).
 *
 * Why an island can keep the site's chrome around it here, where a race cannot,
 * is in make.astro.
 */
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/kit";
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
import { PrintBar } from "./PrintBar";
import {
  Rail,
  TRAY_ID,
  useUnderMasthead,
  type Section,
  type Step,
} from "./Rail";
import { SavedSheets } from "./SavedSheets";
import { FIRST_SHEET } from "./defaults";
import { labelOf, tabOf } from "./shelves";
import { headingLine, letteringLine, paperLine } from "./summary";
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

/** The step a sheet lands on when it arrives: its own options, if it has any. */
const landing = (kind: string): Section | null =>
  tabOf(kind) ? "family" : null;

function Bench({ opening }: { opening: SharedSheet | null }) {
  const bench = useBuilder(opening);
  // A stranger starts at step one. A sheet that arrived by link or out of My
  // sheets has its kind chosen already, so it lands on that kind's own options.
  const [open, setOpen] = useState<Section | null>(() =>
    opening ? landing(bench.config.kind) : "sheet",
  );
  const rail = useRef<HTMLDivElement>(null);
  const print = useRef<HTMLButtonElement>(null);
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

  const kind = bench.config.kind;
  const tab = tabOf(kind);
  const steps: Step[] = [
    { id: "sheet", name: "Sheet type", value: labelOf(kind) },
    ...(tab
      ? [
          {
            id: "family" as const,
            name: tab,
            value: chosen ? chosen.describe(bench.config) : "",
          },
        ]
      : []),
    { id: "paper", name: "Paper", value: paperLine(bench.config) },
    { id: "lettering", name: "Lettering", value: letteringLine(bench.config) },
    { id: "heading", name: "Heading", value: headingLine(bench.config) },
  ];
  const after = steps[steps.findIndex((step) => step.id === open) + 1];
  const isStep = open !== null && open !== "mine";

  const toggle = (section: Section) =>
    setOpen((current) => (current === section ? null : section));

  // A sheet chosen or opened lands on its own options, whichever door it came
  // through: that is where the next question is.
  const choose = (next: string) => {
    bench.setFamily(next);
    setOpen(landing(next));
  };
  const openSheet = (config: SheetConfig, seed: number) => {
    bench.open(config, seed);
    setOpen(landing(config.kind));
  };

  // The last step's "Next" is Print: the tray closes so the whole paper is in
  // view, and focus lands on the button that finishes the job.
  const finish = () => {
    setOpen(null);
    print.current?.focus();
  };

  const panel = { config: bench.config, set: bench.set };

  return (
    <div className="bench">
      <div className="bench__rail no-print" ref={rail}>
        <PrintBar
          variants={bench.variants}
          answers={bench.answers}
          onVariants={bench.setVariants}
          onAnswers={bench.setAnswers}
          onReroll={bench.reroll}
          printRef={print}
        />
        <Rail steps={steps} open={open} onToggle={toggle} />
        <div className="tray" id={TRAY_ID} hidden={open === null}>
          {open === "sheet" && (
            <Chooser kind={kind} onFamily={choose} onOpen={openSheet} />
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
          {isStep && (
            <div className="tray__next wrap">
              {after ? (
                <Button variant="accent" onClick={() => setOpen(after.id)}>
                  Next: {after.name} →
                </Button>
              ) : (
                <Button variant="accent" onClick={finish}>
                  Next: Print →
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* `.no-print` on the frame and not only on the two things inside it:
          both children already carry it, but a frame emptied by `display: none`
          on its contents still has its padding, and the print copy below would
          lay out under it rather than at the top of the paper. */}
      <div className="bench__paper wrap no-print">
        <Preview sheets={sheets} />
        <Caption seed={bench.seed} />
      </div>

      <PrintCopy sheets={sheets} />
    </div>
  );
}
