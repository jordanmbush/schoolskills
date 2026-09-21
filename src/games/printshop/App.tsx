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
 * Until a kind of sheet is chosen there is no sheet, and the bench is step one
 * and nothing else — no later steps, no print row, no paper. The rest appears
 * the moment a kind is picked, which is what makes the first move the only
 * one on offer (§14). From then on the steps have an order and no gate: every
 * one holds a good value, so a parent who only ever presses "Next" walks the
 * order and ends at Print, and one who knows what they want opens any step
 * directly.
 *
 * Why an island can keep the site's chrome around it here, where a race cannot,
 * is in make.astro.
 */
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/kit";
import { buildWith, keyWith, type SheetSpec } from "@/engine/sheets/spec";
import type { Sheet, SheetConfig } from "@/engine/sheets/types";
import "@/styles/printshop.css";

import { Caption } from "./Caption";
import { Chooser } from "./Chooser";
import { FamilyOptions } from "./options";
import type { PanelProps } from "./options/parts";
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
 * The wait for the family a link names, and nothing else.
 *
 * A family is a chunk of its own (§3), and `useBuilder` test-builds whatever
 * the fragment held before it trusts it, so a sheet that arrived by link has
 * nothing to render until its one module is here. An empty address bar waits
 * for nothing: the bench opens on the chooser, and every family chosen from
 * it is fetched underneath a bench that stays on screen.
 */
export default function PrintShopApp() {
  const [opening] = useState(openingSheet);
  const first = useFamily(opening?.config.kind);

  return opening && !first ? null : <Bench opening={opening} />;
}

/** The step a sheet lands on when it arrives: its own options, if it has any. */
const landing = (kind: string): Section | null =>
  tabOf(kind) ? "family" : null;

/**
 * The rail's steps for what is on the bench: the first alone until a kind is
 * chosen, then all of them, each with the line that says what is set in it.
 */
function stepsFor(
  sheet: SharedSheet | null,
  spec: SheetSpec | undefined,
): Step[] {
  if (!sheet) {
    return [{ id: "sheet", name: "Sheet type", value: "Not chosen yet" }];
  }
  const { config } = sheet;
  const tab = tabOf(config.kind);
  return [
    { id: "sheet", name: "Sheet type", value: labelOf(config.kind) },
    ...(tab
      ? [
          {
            id: "family" as const,
            name: tab,
            value: spec ? spec.describe(config) : "",
          },
        ]
      : []),
    { id: "paper", name: "Paper", value: paperLine(config) },
    { id: "lettering", name: "Lettering", value: letteringLine(config) },
    { id: "heading", name: "Heading", value: headingLine(config) },
  ];
}

function Bench({ opening }: { opening: SharedSheet | null }) {
  const bench = useBuilder(opening);
  const { sheet } = bench;
  // A stranger starts at step one. A sheet that arrived by link or out of My
  // sheets has its kind chosen already, so it lands on that kind's own options.
  const [open, setOpen] = useState<Section | null>(() =>
    sheet ? landing(sheet.config.kind) : "sheet",
  );
  const rail = useRef<HTMLDivElement>(null);
  const print = useRef<HTMLButtonElement>(null);
  useUnderMasthead(rail);

  // Memoised so the debounce below has something stable to hold. Without it
  // every render would make a new object, the timer would restart on the render
  // the timer itself caused, and the preview would rebuild forever.
  const live = useMemo(
    () =>
      sheet && {
        config: sheet.config,
        seed: sheet.seed,
        variants: bench.variants,
        answers: bench.answers,
      },
    [sheet, bench.variants, bench.answers],
  );

  const settled = useDebounced(live);

  // Two families, and the second is not a slip. The chooser names the one being
  // chosen and the press builds the one that has settled, which are the same
  // family except in the moment after a switch — and that is exactly when the
  // difference pays, because asking for the live one starts its download while
  // the preview is still holding the old sheet.
  const chosen = useFamily(sheet?.config.kind);
  const printing = useFamily(settled?.config.kind);

  const sheets = useMemo<Sheet[]>(() => {
    if (!printing || !settled) return [];
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

  const steps = stepsFor(sheet, chosen);
  const after = steps[steps.findIndex((step) => step.id === open) + 1];
  // The numbered step in the tray, if the tray holds one rather than My sheets.
  const step = open !== null && open !== "mine" ? open : null;

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

  return (
    <div className={sheet ? "bench" : "bench bench--choosing"}>
      <div className="bench__rail no-print" ref={rail}>
        {sheet && (
          <PrintBar
            variants={bench.variants}
            answers={bench.answers}
            onVariants={bench.setVariants}
            onAnswers={bench.setAnswers}
            onReroll={bench.reroll}
            printRef={print}
          />
        )}
        <Rail steps={steps} open={open} onToggle={toggle} />
        <div className="tray" id={TRAY_ID} hidden={open === null}>
          {open === "sheet" && (
            <Chooser
              kind={sheet?.config.kind ?? null}
              onFamily={choose}
              onOpen={openSheet}
            />
          )}
          {open === "mine" && <SavedSheets sheet={sheet} onOpen={openSheet} />}
          {sheet && step && step !== "sheet" && (
            <Options section={step} config={sheet.config} set={bench.set} />
          )}
          {sheet && step && (
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

      {sheet && (
        <>
          {/* `.no-print` on the frame and not only on the two things inside
              it: both children already carry it, but a frame emptied by
              `display: none` on its contents still has its padding, and the
              print copy below would lay out under it rather than at the top
              of the paper. */}
          <div className="bench__paper wrap no-print">
            <Preview sheets={sheets} />
            <Caption seed={sheet.seed} />
          </div>
          <PrintCopy sheets={sheets} />
        </>
      )}
    </div>
  );
}

/**
 * The tray for a tuning step: the family's own options, or one of the three
 * sections every sheet has (`PageOptions.tsx`).
 */
function Options({ section, ...panel }: { section: Section } & PanelProps) {
  switch (section) {
    case "family":
      return (
        <div className="tray__grid wrap">
          <FamilyOptions {...panel} />
          <AnswerBoxes {...panel} />
        </div>
      );
    case "paper":
      return (
        <div className="tray__grid wrap">
          <PaperOptions {...panel} />
        </div>
      );
    case "lettering":
      return (
        <div className="tray__grid tray__grid--wide wrap">
          <LetteringOptions {...panel} />
        </div>
      );
    case "heading":
      return (
        <div className="tray__grid tray__grid--wide wrap">
          <HeadingOptions {...panel} />
        </div>
      );
    default:
      return null;
  }
}
