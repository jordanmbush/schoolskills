/**
 * Lined, ruled, graph, dot and isometric paper.
 *
 * The one family whose options are nothing but the ruling — so the panel is the
 * shared `RulingControls` and not a line more. Why the sizes are named by their
 * pitch, and why the midline, the descender space and the square appear only
 * where they mean something, is written once beside that control in `parts.tsx`.
 */
import type { PaperConfig } from "@/engine/sheets/types";

import { RulingControls, type PanelProps } from "./parts";

export function PaperPanel({ config, set }: PanelProps<PaperConfig>) {
  return (
    <RulingControls
      rule={config.rule}
      onChange={(patch) => set({ rule: { ...config.rule, ...patch } })}
    />
  );
}
