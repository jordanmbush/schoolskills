/**
 * The one place a `Block` is narrowed.
 *
 * The mirror of `sheetSpec(kind)` in the engine: a block is keyed by the same
 * string its renderer is registered under, so the switch below *is* the
 * narrowing and there is no second place that has to keep in step with the
 * union. Add a kind to `Block` and TypeScript fails here until it is drawn.
 *
 * Every arm is a prop-driven component that imports no service and no storage,
 * which is what the zero-JavaScript property in §2 rests on — a renderer with
 * nothing to hydrate needs no `client:*` directive, so a catalog page ships the
 * markup and nothing else.
 */
import type { Block } from "@/engine/sheets/types";

import type { SheetMetrics } from "../metrics";
import { Blanks } from "./Blanks";
import { Choice } from "./Choice";
import { Clock } from "./Clock";
import { Copywork } from "./Copywork";
import { Crossword } from "./Crossword";
import { Cutline } from "./Cutline";
import { Grid } from "./Grid";
import { Matching } from "./Matching";
import { Problems } from "./Problems";
import { Rules } from "./Rules";
import { Shapes } from "./Shapes";
import { Spacer } from "./Spacer";
import { Trace } from "./Trace";
import { WordSearch } from "./WordSearch";
import { WordShapes } from "./WordShapes";

export function BlockView({
  block,
  metrics,
}: {
  block: Block;
  metrics: SheetMetrics;
}) {
  switch (block.kind) {
    case "problems":
      return <Problems block={block} metrics={metrics} />;
    case "rules":
      return <Rules block={block} metrics={metrics} />;
    case "trace":
      return <Trace block={block} metrics={metrics} />;
    case "copywork":
      return <Copywork block={block} metrics={metrics} />;
    case "grid":
      return <Grid block={block} metrics={metrics} />;
    case "wordsearch":
      return <WordSearch block={block} metrics={metrics} />;
    case "crossword":
      return <Crossword block={block} metrics={metrics} />;
    case "matching":
      return <Matching block={block} metrics={metrics} />;
    case "blanks":
      return <Blanks block={block} metrics={metrics} />;
    case "choice":
      return <Choice block={block} metrics={metrics} />;
    case "wordshapes":
      return <WordShapes block={block} metrics={metrics} />;
    case "clock":
      return <Clock block={block} metrics={metrics} />;
    case "shapes":
      return <Shapes block={block} metrics={metrics} />;
    case "cutline":
      return <Cutline block={block} metrics={metrics} />;
    case "spacer":
      return <Spacer block={block} metrics={metrics} />;
  }
}
