/**
 * The option panels' front door.
 *
 * A registry keyed by `kind`, exactly as `engine/sheets/index.ts` is, and for
 * the same reason: looking a panel up *is* the narrowing, so there is no
 * `switch` over `SheetConfig` here to keep in step with the union. Adding a
 * family is a module beside this one and a line in the table.
 *
 * The one cast in the directory is `panel()` below, and it is worth reading
 * before it is copied. `SheetSpec` gets into its registry for free because
 * `build(config, seed)` only *takes* a config, and TypeScript checks method
 * parameters bivariantly. A panel takes a config **and** a way to patch it, and
 * those two pull in opposite directions — the config is safe to widen, the
 * patch is safe to narrow — so no variance rule can let both through at once.
 * The lookup is what makes it true anyway: a panel is only ever reached through
 * the key its own `kind` is filed under.
 */
import type { ReactNode } from "react";

import type { SheetConfig } from "@/engine/sheets/types";

import { ArithmeticPanel } from "./arithmetic";
import { DecimalsPanel } from "./decimals";
import { FractionsPanel } from "./fractions";
import { GeometryPanel } from "./geometry";
import { HandwritingPanel } from "./handwriting";
import { IntegersPanel } from "./integers";
import { MeasurePanel } from "./measure";
import { MemoryPanel } from "./memory";
import { MoneyPanel } from "./money";
import { MultiplicationPanel } from "./multiplication";
import { PaperPanel } from "./paper";
import { PreAlgebraPanel } from "./prealgebra";
import { RatioPanel } from "./ratio";
import { StatisticsPanel } from "./statistics";
import { TimePanel } from "./time";
import { WordProblemsPanel } from "./wordproblems";
import { WordsPanel } from "./words";
import { WordStudyPanel } from "./wordstudy";
import type { PanelProps } from "./parts";

type FamilyPanel = (props: PanelProps) => ReactNode;

/**
 * Files a family's panel under the union, which the lookup then honours.
 *
 * The assertion says "this panel will only ever be given its own family's
 * config", and the table below is what makes that true: an entry is reached by
 * the `kind` it is keyed on and by nothing else. Written once, here, so that
 * every panel above can stay strictly typed to its own config — a `MoneyPanel`
 * that reached for `regrouping` still fails to compile, which is the property
 * worth protecting.
 *
 * Through `unknown` because the two types genuinely do not overlap in either
 * direction, which is TypeScript being right rather than being awkward: it
 * cannot see the table, and the table is the whole argument. Keeping the
 * assertion in one three-line function is what stops that argument having to be
 * made fifteen times.
 */
const panel = <C extends SheetConfig>(
  Panel: (props: PanelProps<C>) => ReactNode,
): FamilyPanel => Panel as unknown as FamilyPanel;

/**
 * A family with nothing of its own to choose.
 *
 * Blank paper is the spine's own sheet — a header, a footer and nothing else —
 * so every option it has is one of the shared ones above the panel. It is also
 * what a `kind` this build has never heard of falls back to, which keeps the
 * bench open on the shared options rather than blank while somebody works out
 * why the family went missing.
 */
const NO_OPTIONS: FamilyPanel = () => null;

const PANELS: Record<string, FamilyPanel> = {
  blank: NO_OPTIONS,
  paper: panel(PaperPanel),
  arithmetic: panel(ArithmeticPanel),
  multiplication: panel(MultiplicationPanel),
  fractions: panel(FractionsPanel),
  decimals: panel(DecimalsPanel),
  money: panel(MoneyPanel),
  time: panel(TimePanel),
  measure: panel(MeasurePanel),
  geometry: panel(GeometryPanel),
  integers: panel(IntegersPanel),
  prealgebra: panel(PreAlgebraPanel),
  ratio: panel(RatioPanel),
  statistics: panel(StatisticsPanel),
  "word-problems": panel(WordProblemsPanel),
  words: panel(WordsPanel),
  "word-study": panel(WordStudyPanel),
  handwriting: panel(HandwritingPanel),
  memory: panel(MemoryPanel),
};

/**
 * The options that belong to whichever family this config is.
 *
 * The own-property lookup is the same guard `sheetSpec` documents: `kind`
 * arrives from a URL somebody may have typed, and plain `PANELS[kind]` answers
 * `"toString"` with a function off `Object.prototype`, which is truthy, is not a
 * panel, and would be rendered as a component one line later.
 */
export function FamilyOptions({ config, set }: PanelProps) {
  const Panel = Object.hasOwn(PANELS, config.kind)
    ? PANELS[config.kind]
    : NO_OPTIONS;
  return <Panel config={config} set={set} />;
}
