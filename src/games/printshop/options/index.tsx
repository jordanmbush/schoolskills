/**
 * The option panels' front door.
 *
 * A registry keyed by `kind`, exactly as `engine/sheets/index.ts` is, and for
 * the same reason: looking a panel up *is* the narrowing, so there is no
 * `switch` over `SheetConfig` here to keep in step with the union. Adding a
 * family is a module beside this one and a line in the table.
 */
import type { ReactNode } from "react";

import type { SheetConfig } from "@/engine/sheets/types";

import { ArithmeticPanel } from "./arithmetic";
import { CardsPanel } from "./cards";
import { ChartsPanel } from "./charts";
import { DecimalsPanel } from "./decimals";
import { FormsPanel } from "./forms";
import { FractionsPanel } from "./fractions";
import { GeometryPanel } from "./geometry";
import { GrammarPanel } from "./grammar";
import { HandwritingPanel } from "./handwriting";
import { IntegersPanel } from "./integers";
import { MeasurePanel } from "./measure";
import { MemoryPanel } from "./memory";
import { MoneyPanel } from "./money";
import { MultiplicationPanel } from "./multiplication";
import { NetsPanel } from "./nets";
import { PaperPanel } from "./paper";
import { PlannerPanel } from "./planner";
import { PhonicsPanel } from "./phonics";
import { PreAlgebraPanel } from "./prealgebra";
import { PuzzlesPanel } from "./puzzles";
import { RatioPanel } from "./ratio";
import { StatisticsPanel } from "./statistics";
import { TimePanel } from "./time";
import { WordProblemsPanel } from "./wordproblems";
import { WordsPanel } from "./words";
import { WordStudyPanel } from "./wordstudy";
import type { PanelProps } from "./parts";

type FamilyPanel = (props: PanelProps) => ReactNode;

/**
 * Files a family's panel under the union, which the lookup then honours — the
 * one cast in the directory, and worth reading before it is copied.
 *
 * The assertion says "this panel will only ever be given its own family's
 * config", and the table below is what makes that true: an entry is reached by
 * the `kind` it is keyed on and by nothing else. `SheetSpec` needs no such cast
 * because `build(config, seed)` only *takes* a config, which TypeScript checks
 * bivariantly; a panel takes a config **and** a way to patch it, and those two
 * pull in opposite directions, so no variance rule can let both through at once.
 * Hence `unknown`: the two types genuinely do not overlap either way.
 *
 * Written once, here, so every panel can stay strictly typed to its own config —
 * a `MoneyPanel` that reached for `regrouping` still fails to compile.
 */
const panel = <C extends SheetConfig>(
  Panel: (props: PanelProps<C>) => ReactNode,
): FamilyPanel => Panel as unknown as FamilyPanel;

/**
 * A family with nothing of its own to choose — blank paper, whose every option
 * is one of the shared ones above the panel. It is also what a `kind` this build
 * has never heard of falls back to, so the bench stays open on the shared
 * options rather than going blank.
 */
const NO_OPTIONS: FamilyPanel = () => null;

const PANELS: Record<string, FamilyPanel> = {
  blank: NO_OPTIONS,
  paper: panel(PaperPanel),
  chart: panel(ChartsPanel),
  form: panel(FormsPanel),
  planner: panel(PlannerPanel),
  cards: panel(CardsPanel),
  net: panel(NetsPanel),
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
  puzzle: panel(PuzzlesPanel),
  grammar: panel(GrammarPanel),
  phonics: panel(PhonicsPanel),
  handwriting: panel(HandwritingPanel),
  memory: panel(MemoryPanel),
};

/**
 * The options that belong to whichever family this config is.
 *
 * The own-property lookup is the same guard `sheetSpec` documents: `kind`
 * arrives from a URL somebody may have typed, and plain `PANELS[kind]` answers
 * `"toString"` with a function off `Object.prototype` — truthy, not a panel, and
 * rendered as a component one line later.
 */
export function FamilyOptions({ config, set }: PanelProps) {
  const Panel = Object.hasOwn(PANELS, config.kind)
    ? PANELS[config.kind]
    : NO_OPTIONS;
  return <Panel config={config} set={set} />;
}
