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
 * Reading one back is a different job from writing one, and the harder half: a
 * payload that arrives from outside this build is untrusted input, so the
 * decoder is length-capped, checks what it decoded against the spec, and
 * answers `null` rather than throwing. It sits here with the encoder because
 * the two are one format — a guard written in the builder would be a second
 * place the shape of `#s=` is written down, and the pair can be tested in plain
 * Node without a browser to open a link in.
 */
import type {
  HeaderField,
  MarginSize,
  Orientation,
  Paper,
  PaperSize,
  SheetConfig,
  SheetFont,
  SheetOptions,
} from "./types";

import { FACES } from "./faces";
import { DEFAULT_FONT_PT, FONT_PT, MARGINS, PAPERS } from "./paper";

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

/* ── Reading one back ──────────────────────────────────────────────────────
   Everything below treats the payload as hostile, because it is: a fragment is
   whatever was in the address bar. The failure mode being guarded against is
   not a stolen secret — there is nothing here to steal, and the fragment never
   reaches a server — it is a builder that throws on load and shows a parent a
   blank page instead of a worksheet.                                        */

/**
 * The longest payload worth decoding.
 *
 * A configured sheet is a few hundred characters; the biggest one this build
 * can make — every table, every denominator, a title and an instruction — is
 * under a thousand. Four kilobytes is room for several times that and still far
 * too small to be worth handing to `JSON.parse` as a denial-of-service, which
 * is the only thing a cap on a client-side decoder can buy.
 */
export const MAX_SHARE_PAYLOAD = 4096;

/**
 * Long enough for a real title, short enough that a URL can't carry an essay.
 *
 * Exported because the builder's own fields have to stop where the decoder
 * stops. A box that accepted more than this would silently lose the tail of
 * what somebody typed the first time the link was reopened, which is the worst
 * of the three possible behaviours.
 */
export const MAX_TITLE = 120;
export const MAX_INSTRUCTIONS = 400;

const FIELDS: HeaderField[] = ["name", "date", "class"];
/**
 * Read off the faces the engine actually has rather than listed again here. A
 * second list is a second thing to remember: a face added to `FACES` and left
 * out of this one would decode to the print face, so a shared cursive sheet
 * would open on the bench in print and nothing would say why.
 */
const FONTS = Object.keys(FACES) as SheetFont[];
const ORIENTATIONS: Orientation[] = ["portrait", "landscape"];

/** One of a known set, or the fallback. Never what the payload said. */
function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as T)
    : fallback;
}

function text(value: unknown, cap: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, cap);
  return trimmed === "" ? undefined : trimmed;
}

function paperOf(value: unknown): Paper {
  const raw = (value ?? {}) as Partial<Paper>;
  return {
    size: oneOf(raw.size, Object.keys(PAPERS) as PaperSize[], "letter"),
    orientation: oneOf(raw.orientation, ORIENTATIONS, "portrait"),
    margin: oneOf(raw.margin, Object.keys(MARGINS) as MarginSize[], "normal"),
  };
}

/**
 * The half of a config every family shares, rebuilt from what arrived.
 *
 * Rebuilt rather than checked: every field is taken from a known set or
 * replaced, so what comes out is a `SheetOptions` whatever went in, and a
 * payload carrying `paper: 7` produces Letter rather than an exception four
 * modules downstream in `pageSize`.
 *
 * The family's own fields are passed through untouched, and that is a decision
 * rather than an omission. Each family already treats its config as untrusted —
 * counts are capped at what the page holds, tables are clamped, every lookup
 * keyed by a saved string goes through `own()` — because a config from a
 * *saved sheet* has always been able to say anything. Re-validating fifteen
 * families' worth of fields here would be a second copy of those rules, and the
 * second copy is the one that goes stale.
 */
function options(raw: Record<string, unknown>): SheetOptions {
  // Filtered from the known list rather than from what arrived, so the order is
  // ours and a payload asking for the name line four times gets it once.
  const asked: unknown[] = Array.isArray(raw.fields) ? raw.fields : [];
  const fields = FIELDS.filter((field) => asked.includes(field));
  const fontPt = typeof raw.fontPt === "number" ? Math.round(raw.fontPt) : NaN;
  const title = text(raw.title, MAX_TITLE);
  const instructions = text(raw.instructions, MAX_INSTRUCTIONS);

  // The four optional fields are omitted rather than written as `undefined` or
  // `false`, so that decoding a link and re-encoding it produces the same link.
  // A round trip that quietly grew `"answerBox":false` would make every URL a
  // little longer each time somebody opened one and sent it on.
  return {
    paper: paperOf(raw.paper),
    fontPt: Number.isFinite(fontPt)
      ? Math.min(FONT_PT.max, Math.max(FONT_PT.min, fontPt))
      : DEFAULT_FONT_PT,
    fields,
    ...(title ? { title } : {}),
    ...(instructions ? { instructions } : {}),
    ...(typeof raw.font === "string"
      ? { font: oneOf(raw.font, FONTS, "print") }
      : {}),
    ...(raw.answerBox === true ? { answerBox: true } : {}),
    ...(raw.cutLines === true ? { cutLines: true } : {}),
  };
}

/**
 * A shared sheet, or `null` if that isn't what the fragment held.
 *
 * `null` and not a thrown error, and not a default sheet either. The caller is
 * the one screen that knows what to open on instead — a builder falls back to
 * its own starting config, and telling it "there was nothing here" is a
 * different thing from handing it a blank sheet that looks like a choice
 * somebody made.
 */
export function decodeSharedSheet(payload: string): SharedSheet | null {
  if (payload.length === 0 || payload.length > MAX_SHARE_PAYLOAD) return null;

  let parsed: unknown;
  try {
    const padded = payload.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    // Not base64, not UTF-8, not JSON — three ways of saying the same thing:
    // whatever is after `#s=` was not written by the encoder above.
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const shared = parsed as { config?: unknown; seed?: unknown };
  if (typeof shared.config !== "object" || shared.config === null) return null;

  const raw = shared.config as Record<string, unknown>;
  if (typeof raw.kind !== "string" || raw.kind === "") return null;

  // The seed decides *which* of the infinitely many sheets a config makes this
  // is (§7). A fraction or a negative would still build — `mulberry32` starts
  // with `seed >>> 0` — but it would build a different sheet than the one that
  // was shared, which is the whole thing a link is for.
  const seed = shared.seed;
  if (typeof seed !== "number" || !Number.isSafeInteger(seed) || seed < 0)
    return null;

  return {
    config: { ...raw, ...options(raw) } as SheetConfig,
    seed,
  };
}
