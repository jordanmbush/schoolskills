import { useEffect } from "react";

import { deckSpec, modeOf } from "@/engine/decks";
import type { RaceConfig } from "@/engine/types";
import type { World } from "@/engine/worlds";

/**
 * Moving the game between worlds.
 *
 * The world is a single attribute on <html> and every colour in the app is
 * derived from it (src/styles/worlds.css), so changing subject is a one-line
 * write rather than a re-render. Picking a spelling list on the setup screen
 * turns the whole screen into the jungle while you watch, which is the entire
 * point of doing it this way.
 *
 * A screen that doesn't call this stays in whatever world the page was served
 * in — which is why the hook restores rather than clears on unmount. The Astro
 * page is the authority on where you are by default; a screen only borrows.
 */
const PAGE_WORLD: World =
  typeof document === "undefined"
    ? "grid"
    : ((document.documentElement.dataset.world as World | undefined) ?? "grid");

export function useWorld(world: World): void {
  useEffect(() => {
    document.documentElement.dataset.world = world;
    return () => {
      document.documentElement.dataset.world = PAGE_WORLD;
    };
  }, [world]);
}

/**
 * Which world a race is run in. Routed through the deck front door rather than
 * read off the config, so a saved run finds its scenery by `mode` the same way
 * it finds everything else about the deck it was played on.
 */
export const worldOfRace = (config: RaceConfig): World =>
  deckSpec(modeOf(config)).world;
