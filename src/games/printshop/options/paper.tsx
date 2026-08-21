/**
 * Lined, ruled, graph, dot and isometric paper — the one family whose options
 * are nothing but the ruling, so the panel is the shared `RulingControls` and
 * not a line more. Why it asks what it asks is beside it in `ruling.tsx`.
 */
import type { PaperConfig } from "@/engine/sheets/types";

import type { PanelProps } from "./parts";
import { RulingControls } from "./ruling";

export function PaperPanel({ config, set }: PanelProps<PaperConfig>) {
  return (
    <RulingControls
      rule={config.rule}
      onChange={(patch) => set({ rule: { ...config.rule, ...patch } })}
    />
  );
}
