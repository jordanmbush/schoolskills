/**
 * Everything the bench holds: the sheet, if there is one yet, how many copies
 * of it, and whether the answer key comes too.
 *
 * Everything else on the screen is derived from those. `buildSheet(config,
 * seed)` is deterministic (§7), so the preview, the answer key, the variants
 * and the shareable URL are all functions of the same few values rather than
 * four things kept in step.
 *
 * There is no sheet until a family is chosen or a link names one. A default
 * sheet used to fill that gap, and it answered the first question before a
 * stranger knew it was being asked (§14): the bench now holds nothing, and
 * shows nothing, until the choice is made.
 *
 * The config lives in the URL (§14), and every change rewrites `#s=` with
 * `replaceState` rather than `pushState` — a builder that pushed a history entry
 * per keystroke would take a hundred presses of Back to leave.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { loadedSheet } from "@/engine/sheets/families";
import { decodeSharedSheet, encodeSharedSheet } from "@/engine/sheets/share";
import { buildWith } from "@/engine/sheets/spec";
import type { SheetConfig } from "@/engine/sheets/types";

import { defaultConfig } from "./defaults";

/** How long the preview waits after the last press before it redraws. */
export const REDRAW_DELAY = 160;

/** Copies of the sheet, each from its own seed. §17 asks for up to five. */
export const MAX_VARIANTS = 5;

export type Builder = {
  /** What is on the bench, or nothing until a family is chosen. */
  sheet: SharedSheet | null;
  variants: number;
  /** Print the answer key after each variant. */
  answers: boolean;
  /**
   * Patch the current family's config. Never changes which family it is, and
   * does nothing while there is no sheet to patch.
   */
  set: (patch: Partial<SheetConfig>) => void;
  /** Choose a family, opening on that family's own starting sheet. */
  setFamily: (kind: string) => void;
  /** Load a whole sheet — a shared link, or one out of My Sheets. */
  open: (config: SheetConfig, seed: number) => void;
  /**
   * Take the sheet off the bench, which is what changing subject does: a type
   * from another subject cannot stand under the new one. The paper is kept
   * for the next sheet, for the reason `setFamily` gives.
   */
  clear: () => void;
  /** The same config, a different draw of it (§7). */
  reroll: () => void;
  setVariants: (count: number) => void;
  setAnswers: (on: boolean) => void;
};

/** A whole sheet: a family tuned some way, and which draw of it (§7). */
export type SharedSheet = { config: SheetConfig; seed: number };

/**
 * What the fragment held when the page opened, if it held a sheet.
 *
 * Read once, before the bench mounts, and never again: the hook rewrites `#s=`
 * on every change from then on, so re-reading it would be reading its own
 * handwriting. `App` is what reads it, because the family it names has to be
 * fetched before there is anything to test-build.
 */
export function openingSheet(): SharedSheet | null {
  if (typeof window === "undefined") return null;
  const match = /^#s=(.*)$/.exec(window.location.hash);
  return match ? decodeSharedSheet(match[1]) : null;
}

/**
 * Whether a shared sheet survives being built.
 *
 * `decodeSharedSheet` rebuilds the half of a config every family shares and
 * leaves each family's own fields alone, so this is the belt to that pair of
 * braces — and the one place §14's "fall back rather than throwing" is
 * actually kept. A link that fails here opens the bench on the chooser, the
 * same as no link at all.
 *
 * Both halves, because a family reaches into its own config twice: once to make
 * the page and once to say in a line what is on it. A bench that built the paper
 * and then threw on the caption is no better than one that threw on the paper.
 *
 * Synchronous, and entitled to be: `App` renders nothing until this family's
 * module has landed, so there is always a spec in hand by the time the bench
 * first mounts.
 */
function survivesBuilding({ config, seed }: SharedSheet): boolean {
  const spec = loadedSheet(config.kind);
  if (!spec) return false;
  try {
    buildWith(spec, config, seed);
    spec.describe(config);
  } catch {
    return false;
  }
  return true;
}

export function useBuilder(opening: SharedSheet | null): Builder {
  // Lazily, so the very first paint is already the shared sheet rather than
  // the chooser replaced a tick later.
  const [sheet, setSheet] = useState<SharedSheet | null>(() =>
    opening && survivesBuilding(opening) ? opening : null,
  );
  const [variants, setVariants] = useState(1);
  const [answers, setAnswers] = useState(false);

  // The last sheet's paper, so that a sheet chosen after a clear opens on the
  // paper a parent had already chosen about their printer.
  const paper = useRef<SheetConfig["paper"] | null>(null);
  useEffect(() => {
    if (sheet) paper.current = sheet.config.paper;
  }, [sheet]);

  // The hash this hook last wrote. Compared before writing so that a change
  // which happens to produce the same URL — pressing + and then − — doesn't
  // touch the address bar at all.
  const written = useRef<string | null>(null);

  useEffect(() => {
    if (!sheet) {
      // Cleared rather than never set: the address bar still names the sheet
      // that was here, and a reload would bring it back.
      if (written.current !== null) {
        written.current = null;
        const { pathname, search } = window.location;
        window.history.replaceState(null, "", pathname + search);
      }
      return;
    }
    const payload = encodeSharedSheet(sheet);
    if (written.current === payload) return;
    written.current = payload;
    window.history.replaceState(null, "", `#s=${payload}`);
  }, [sheet]);

  const set = useCallback((patch: Partial<SheetConfig>) => {
    // Cast at the one point a patch meets a union. The panels are each typed to
    // their own family and can only produce a patch of it; what is lost here is
    // TypeScript's ability to prove that the patch and the config are the same
    // member, which no spread of a union can express.
    setSheet(
      (current) =>
        current && {
          ...current,
          config: { ...current.config, ...patch } as SheetConfig,
        },
    );
  }, []);

  const setFamily = useCallback((kind: string) => {
    // A fresh config rather than a merge. Sharing `count` and `columns` across
    // families looks thoughtful and prints a page of six long divisions in
    // three columns, because the numbers mean different things in each. Paper
    // is the exception: somebody who has chosen A4 has chosen it about their
    // printer, not about long division.
    setSheet((current) => {
      const fresh = defaultConfig(kind);
      return {
        seed: current?.seed ?? 1,
        config: {
          ...fresh,
          paper: current?.config.paper ?? paper.current ?? fresh.paper,
        },
      };
    });
  }, []);

  const open = useCallback((config: SheetConfig, seed: number) => {
    setSheet({ config, seed });
  }, []);

  const clear = useCallback(() => setSheet(null), []);

  const reroll = useCallback(() => {
    setSheet((current) => current && { ...current, seed: current.seed + 1 });
  }, []);

  return {
    sheet,
    variants,
    answers,
    set,
    setFamily,
    open,
    clear,
    reroll,
    setVariants,
    setAnswers,
  };
}

/**
 * A value that lags behind by `delay`, so the preview redraws once a parent has
 * stopped rather than once per keystroke (§14). Every generator here
 * draws-and-rejects rather than enumerating, so the cost of two hundred problems
 * is real at the top of a range.
 *
 * The controls themselves are never debounced — a stepper that answered a sixth
 * of a second late would feel broken — only the paper is.
 */
export function useDebounced<T>(value: T, delay = REDRAW_DELAY): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
