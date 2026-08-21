import type { APIRoute } from "astro";

import { searchIndex } from "./_search";

/**
 * The search index, as a file on disk.
 *
 * A static endpoint rather than a script that writes into `public/`: emitted
 * from a route, it is rebuilt by the same command that rebuilds the pages it
 * describes, from the same imports, so it cannot be a stale artefact somebody
 * forgot to run. `astro build` writes it to
 * `dist/printables/search-index.json`, and `scripts/search-index-guard.mjs`
 * reads it back off disk afterwards and fails the build if a sheet in `dist/`
 * is missing from it.
 *
 * No indent, deliberately: it lands on a phone, and pretty-printing the rows
 * would add a fifth to it for the benefit of nobody. The shape is documented
 * where it is defined, in `@/engine/sheets/search`.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(searchIndex()), {
    headers: { "content-type": "application/json" },
  });
