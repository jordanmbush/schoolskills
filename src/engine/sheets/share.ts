/**
 * A sheet, as something that fits in a link.
 *
 * §14 settles the mechanism: the builder's config lives in the URL fragment,
 * `#s=<base64url(JSON)>`. That is a static site's whole sharing story — there
 * is no server to hold a saved configuration and hand back a short id, so the
 * configuration *is* the id — and it costs nothing: a fragment is never sent to
 * a server at all, which is the same promise §1 makes about everything else
 * here.
 *
 * It buys three things at once. A catalog page can offer "change what is on
 * this sheet" as an ordinary link, a configured sheet can be passed round a
 * class group, and a bug report is reproducible because the report carries the
 * sheet rather than a description of it.
 *
 * The seed travels with the config for the reason §7 gives: a sheet is
 * reproducible from its URL only if the URL says which one of the infinitely
 * many sheets that config makes was meant. Without it, a parent who followed a
 * link would get the same *kind* of sheet and different problems, which is a
 * feature (`seed + 1`) offered by accident.
 *
 * **A child's name is never in here.** The name line is printed blank and
 * filled in by hand (§1), there is nowhere in a `SheetConfig` to put one, and a
 * shared link is exactly the surface where that would otherwise leak.
 *
 * Only the encoder lives here. Reading one of these back is the builder's job,
 * and it is a different job: a payload that arrives from outside this build is
 * untrusted input — length-capped, validated against the spec, and falling back
 * to defaults rather than throwing — which is a guard with nothing to guard
 * until there is something to open it in.
 */
import type { SheetConfig } from "./types";

/** What a link carries: which sheet, and which one of them. */
export type SharedSheet = { config: SheetConfig; seed: number };

/**
 * The payload half of `#s=…` — base64url, so it survives a URL, an email and a
 * printed page without being escaped into something a reader can't retype.
 *
 * Base64url rather than plain base64 for the usual three characters: `+` and
 * `/` are legal in a fragment but travel badly through anything that re-encodes
 * a link, and `=` padding is noise a decoder can restore for itself. The bytes
 * are UTF-8 first, because `btoa` speaks in code units below 256 and a title
 * somebody typed in another language would otherwise throw.
 */
export function encodeSharedSheet(shared: SharedSheet): string {
  const bytes = new TextEncoder().encode(JSON.stringify(shared));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
