/**
 * What every block renderer is handed.
 *
 * One renderer per `Block` kind, each taking its own member of the union and
 * the page metrics — no context, no service, no storage, and nothing it could
 * ask a question of. That is what makes the zero-JavaScript property in §2 hold
 * by construction rather than by discipline.
 */
import type { Block } from "@/engine/sheets/types";

import type { SheetMetrics } from "../metrics";

export type BlockOf<K extends Block["kind"]> = Extract<Block, { kind: K }>;

export type BlockProps<K extends Block["kind"]> = {
  block: BlockOf<K>;
  metrics: SheetMetrics;
};
