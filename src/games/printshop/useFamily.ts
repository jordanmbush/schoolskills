/**
 * A sheet family, fetched the moment the bench needs it.
 *
 * Every family is a chunk of its own (`engine/sheets/families.ts`), so the
 * builder holds a spec rather than importing one — and the answer is looked up
 * by the kind being asked about rather than remembered from the last module
 * that arrived, which is what makes "family A's spec over family B's config"
 * unrepresentable rather than merely unlikely.
 *
 * Returns nothing until the module is here. That is a real state and the bench
 * renders it: there is no paper to draw before the family that draws it lands.
 */
import { useEffect, useState } from "react";

import { loadSheet, loadedSheet } from "@/engine/sheets/families";
import type { SheetSpec } from "@/engine/sheets/spec";

export function useFamily(kind: string): SheetSpec | undefined {
  const [, redraw] = useState(0);
  const spec = loadedSheet(kind);

  useEffect(() => {
    if (loadedSheet(kind)) return;
    let live = true;
    void loadSheet(kind).then(() => {
      if (live) redraw((count) => count + 1);
    });
    return () => {
      live = false;
    };
  }, [kind]);

  return spec;
}
