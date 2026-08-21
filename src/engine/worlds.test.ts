import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { THEME_COLOUR, WORLDS, type World } from "./worlds";

/**
 * The registry both halves of the site read, held to the two things it can't
 * type-check about itself.
 *
 * `THEME_COLOUR` is `Record<World, string>`, so a missing entry is already a
 * type error — what a type cannot say is whether the colour in it is the one
 * `worlds.css` paints. Those two are the only duplication in the world system,
 * and they are duplicated for a reason that isn't going away: `<meta
 * name="theme-color">` is markup, and markup cannot read a custom property. A
 * world whose chrome is a shade off its own page is the sort of thing nobody
 * files a bug about and everybody sees.
 *
 * The links are the other half. A world's `href` is what the map, the masthead
 * and the footer point at, and its `island` is what `astro.config.mjs` keeps
 * out of the sitemap — a string that no longer matches a page doesn't fail
 * anything at build time: it just quietly becomes a 404 on the map, or stops
 * excluding the game route it was there to exclude.
 *
 * Both ends are read out of the tree rather than written down here, so a world
 * added tomorrow is checked tomorrow.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..");

/**
 * The `World` union, read out of the type rather than off `THEME_COLOUR`.
 *
 * Taking the list from the record under test would agree with any record at
 * all. The type is what the rest of the codebase narrows against, so it is the
 * side that decides which worlds exist.
 */
function declaredWorlds(): string[] {
  const source = readFileSync(join(SRC, "engine/worlds.ts"), "utf8");
  const union = /export type World\s*=([\s\S]*?);/.exec(source);
  return [...(union?.[1] ?? "").matchAll(/"([a-z]+)"/g)].map(
    (match) => match[1],
  );
}

/** What `worlds.css` paints as the darkest ink of each world it dresses. */
function styledWorlds(): Map<string, string> {
  const source = readFileSync(join(SRC, "styles/worlds.css"), "utf8");
  const blocks = source.matchAll(/\[data-world="([a-z]+)"\]\s*\{([^}]*)\}/g);
  const found = new Map<string, string>();
  for (const [, world, body] of blocks) {
    const ink = /--ink-900:\s*(#[0-9a-f]{3,8})/i.exec(body);
    if (ink) found.set(world, ink[1].toLowerCase());
  }
  return found;
}

/**
 * Every route this build emits as a page of its own.
 *
 * Read off `src/pages/`, which is where Astro decides routes, and not off
 * `dist/` — the suite has to say the same thing whether or not somebody has
 * built the site since their last edit, and a check that quietly passes when
 * `dist/` is missing is worse than none.
 *
 * Static routes only: a `[slug]` page emits whatever its `getStaticPaths`
 * returns, which is a question for the catalog guards. No world has ever
 * pointed at one, and one that did would fail here rather than be waved
 * through — which is the right way round for a link on the map.
 */
function staticRoutes(dir = join(SRC, "pages"), prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    // `_name.ts` is a helper Astro never routes; `[slug]` is a dynamic one.
    if (entry.name.startsWith("_") || entry.name.includes("[")) return [];
    if (entry.isDirectory()) {
      return staticRoutes(join(dir, entry.name), `${prefix}/${entry.name}`);
    }
    if (!entry.name.endsWith(".astro")) return [];
    const name = entry.name.replace(/\.astro$/, "");
    return [name === "index" ? prefix || "/" : `${prefix}/${name}`];
  });
}

const DECLARED = declaredWorlds();
const STYLED = styledWorlds();
const ROUTES = staticRoutes();

/** Every link a world hands out, and what to call it when one is wrong. */
const LINKS = WORLDS.flatMap((world) => [
  [`${world.name}'s front door`, world.href] as const,
  [`${world.name}'s island`, world.island] as const,
  ...(world.guide
    ? [[`${world.name}'s guide`, world.guide.href] as const]
    : []),
]);

describe("the worlds", () => {
  it("are the ones the type says exist", () => {
    // Without this the two comparisons below could both hold over an empty
    // list: a regex that stopped matching would report every world fine.
    expect(
      DECLARED.length,
      "no worlds were parsed out of the World union — the check below would pass over an empty list",
    ).toBeGreaterThan(1);

    expect(Object.keys(THEME_COLOUR).sort()).toEqual([...DECLARED].sort());
    expect(WORLDS.every((world) => DECLARED.includes(world.id))).toBe(true);
  });

  it.each(DECLARED)(
    "%s is themed the same colour in the chrome as on the page",
    (world) => {
      expect(
        STYLED.size,
        "no [data-world] blocks were found in worlds.css",
      ).toBeGreaterThan(1);

      // The browser chrome joins the page rather than framing it in whatever
      // the previous world left behind. `THEME_COLOUR` is the only copy of
      // these seven values outside the stylesheet, and this is the line that
      // keeps them in step.
      expect(
        THEME_COLOUR[world as World],
        `theme-color for "${world}" and its --ink-900 in worlds.css have drifted apart`,
      ).toBe(STYLED.get(world));
    },
  );

  it.each(LINKS)("%s (%s) is a page this build emits", (what, href) => {
    // A guard against the walk, not against the worlds: an empty route list
    // would fail every case below with the same unhelpful message.
    expect(
      ROUTES.length,
      "no pages were found under src/pages/",
    ).toBeGreaterThan(1);

    expect(
      ROUTES.includes(href),
      `${what} points at ${href}, and no page in src/pages/ builds that route. The routes this build emits are:\n  ${[...ROUTES].sort().join("\n  ")}`,
    ).toBe(true);
  });
});
