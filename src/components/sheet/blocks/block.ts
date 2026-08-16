/**
 * What every block renderer is handed.
 *
 * One renderer per `Block` kind, each taking its own member of the union and
 * the page metrics — no context, no service, no storage, and nothing it could
 * ask a question of. That is what lets the same component render at build time
 * on a catalog page and at runtime in the builder without knowing which one it
 * is in (§2), and it is why the zero-JavaScript property holds by construction
 * rather than by discipline.
 */
import type { Block } from "@/engine/sheets/types";

import type { SheetMetrics } from "../metrics";

export type BlockOf<K extends Block["kind"]> = Extract<Block, { kind: K }>;

export type BlockProps<K extends Block["kind"]> = {
  block: BlockOf<K>;
  metrics: SheetMetrics;
};
