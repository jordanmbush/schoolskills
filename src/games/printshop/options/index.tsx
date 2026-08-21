/**
 * The option panels' front door.
 *
 * A registry keyed by `kind`, exactly as `engine/sheets/families.ts` is, and for
 * the same two reasons: looking a panel up *is* the narrowing, so there is no
 * `switch` over `SheetConfig` here to keep in step with the union — and each
 * entry is a `import()` rather than an import, so a panel arrives with the
 * family it belongs to instead of with the twenty-six it doesn't. Several of
 * them are the expensive half: the passage picker under copywork reads the
 * whole library, Scripture included. Adding a family is a module beside this
 * one and a line in the table.
 */
import { Suspense, lazy, type ComponentType, type ReactNode } from "react";

import type { SheetConfig } from "@/engine/sheets/types";

import type { PanelProps } from "./parts";

type FamilyPanel = ComponentType<PanelProps>;

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
  load: () => Promise<(props: PanelProps<C>) => ReactNode>,
): FamilyPanel =>
  lazy(async () => ({ default: await load() })) as unknown as FamilyPanel;

/**
 * A family with nothing of its own to choose — blank paper, whose every option
 * is one of the shared ones above the panel. It is also what a `kind` this build
 * has never heard of falls back to, so the bench stays open on the shared
 * options rather than going blank.
 */
const NO_OPTIONS: FamilyPanel = () => null;

const PANELS: Record<string, FamilyPanel> = {
  blank: NO_OPTIONS,
  paper: panel(async () => (await import("./paper")).PaperPanel),
  chart: panel(async () => (await import("./charts")).ChartsPanel),
  form: panel(async () => (await import("./forms")).FormsPanel),
  planner: panel(async () => (await import("./planner")).PlannerPanel),
  cards: panel(async () => (await import("./cards")).CardsPanel),
  net: panel(async () => (await import("./nets")).NetsPanel),
  arithmetic: panel(async () => (await import("./arithmetic")).ArithmeticPanel),
  multiplication: panel(
    async () => (await import("./multiplication")).MultiplicationPanel,
  ),
  fractions: panel(async () => (await import("./fractions")).FractionsPanel),
  decimals: panel(async () => (await import("./decimals")).DecimalsPanel),
  money: panel(async () => (await import("./money")).MoneyPanel),
  time: panel(async () => (await import("./time")).TimePanel),
  measure: panel(async () => (await import("./measure")).MeasurePanel),
  geometry: panel(async () => (await import("./geometry")).GeometryPanel),
  integers: panel(async () => (await import("./integers")).IntegersPanel),
  prealgebra: panel(async () => (await import("./prealgebra")).PreAlgebraPanel),
  ratio: panel(async () => (await import("./ratio")).RatioPanel),
  statistics: panel(async () => (await import("./statistics")).StatisticsPanel),
  "word-problems": panel(
    async () => (await import("./wordproblems")).WordProblemsPanel,
  ),
  words: panel(async () => (await import("./words")).WordsPanel),
  "word-study": panel(async () => (await import("./wordstudy")).WordStudyPanel),
  puzzle: panel(async () => (await import("./puzzles")).PuzzlesPanel),
  grammar: panel(async () => (await import("./grammar")).GrammarPanel),
  phonics: panel(async () => (await import("./phonics")).PhonicsPanel),
  handwriting: panel(
    async () => (await import("./handwriting")).HandwritingPanel,
  ),
  memory: panel(async () => (await import("./memory")).MemoryPanel),
};

/**
 * The options that belong to whichever family this config is.
 *
 * The own-property lookup is the same guard `sheetSpec` documents: `kind`
 * arrives from a URL somebody may have typed, and plain `PANELS[kind]` answers
 * `"toString"` with a function off `Object.prototype` — truthy, not a panel, and
 * rendered as a component one line later.
 *
 * Nothing while a panel is on its way, rather than a spinner: the heading above
 * it stays put and the shared options below it never move, so what a parent sees
 * is one group filling in — and the paper beside it is waiting on the same
 * fetch anyway.
 */
export function FamilyOptions({ config, set }: PanelProps) {
  const Panel = Object.hasOwn(PANELS, config.kind)
    ? PANELS[config.kind]
    : NO_OPTIONS;
  return (
    <Suspense fallback={null}>
      <Panel config={config} set={set} />
    </Suspense>
  );
}
