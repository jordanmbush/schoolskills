/**
 * Everything the bench holds: a config, a seed, and how many copies of it.
 *
 * Five values, and everything else on the screen is derived from them.
 * `buildSheet(config, seed)` is deterministic (§7), so the preview, the answer
 * key, the variants and the shareable URL are all functions of the same five
 * rather than four things kept in step.
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

import { defaultConfig, FIRST_SHEET } from "./defaults";

/** How long the preview waits after the last press before it redraws. */
export const REDRAW_DELAY = 160;

/** Copies of the sheet, each from its own seed. §17 asks for up to five. */
export const MAX_VARIANTS = 5;

export type Builder = {
  config: SheetConfig;
  seed: number;
  variants: number;
  /** Print the answer key after each variant. */
  answers: boolean;
  /** Patch the current family's config. Never changes which family it is. */
  set: (patch: Partial<SheetConfig>) => void;
  /** Swap family, opening on that family's own starting sheet. */
  setFamily: (kind: string) => void;
  /** Load a whole sheet — a shared link, or one out of My Sheets. */
  open: (config: SheetConfig, seed: number) => void;
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
 * braces — and the one place §14's "fall back to defaults rather than throwing"
 * is actually kept.
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
  // Lazily, so the very first paint is already the shared sheet rather than the
  // default one replaced a tick later.
  const [state, setState] = useState<SharedSheet>(() =>
    opening && survivesBuilding(opening)
      ? opening
      : { config: defaultConfig(FIRST_SHEET), seed: 1 },
  );
  const [variants, setVariants] = useState(1);
  const [answers, setAnswers] = useState(false);

  // The hash this hook last wrote. Compared before writing so that a change
  // which happens to produce the same URL — pressing + and then − — doesn't
  // touch the address bar at all.
  const written = useRef<string | null>(null);

  useEffect(() => {
    const payload = encodeSharedSheet({
      config: state.config,
      seed: state.seed,
    });
    if (written.current === payload) return;
    written.current = payload;
    window.history.replaceState(null, "", `#s=${payload}`);
  }, [state]);

  const set = useCallback((patch: Partial<SheetConfig>) => {
    // Cast at the one point a patch meets a union. The panels are each typed to
    // their own family and can only produce a patch of it; what is lost here is
    // TypeScript's ability to prove that the patch and the config are the same
    // member, which no spread of a union can express.
    setState((current) => ({
      ...current,
      config: { ...current.config, ...patch } as SheetConfig,
    }));
  }, []);

  const setFamily = useCallback((kind: string) => {
    // A fresh config rather than a merge. Sharing `count` and `columns` across
    // families looks thoughtful and prints a page of six long divisions in
    // three columns, because the numbers mean different things in each.
    setState((current) => ({
      ...current,
      config: { ...defaultConfig(kind), paper: current.config.paper },
    }));
  }, []);

  const open = useCallback((config: SheetConfig, seed: number) => {
    setState({ config, seed });
  }, []);

  const reroll = useCallback(() => {
    setState((current) => ({ ...current, seed: current.seed + 1 }));
  }, []);

  return {
    config: state.config,
    seed: state.seed,
    variants,
    answers,
    set,
    setFamily,
    open,
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
