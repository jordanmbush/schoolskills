/**
 * Everything the bench holds: a config, a seed, and how many copies of it.
 *
 * The state is deliberately small — five values — because everything else on
 * the screen is derived from them. `buildSheet(config, seed)` is deterministic
 * (§7), so the preview, the answer key, the variants and the shareable URL are
 * all functions of the same five values rather than four things kept in step.
 *
 * **The URL is the save file.** A static site has no server to hand back a
 * short id for a configuration, so the configuration *is* the id (§14): every
 * change rewrites `#s=`, which makes the address bar a bookmark, a way to send
 * a sheet to somebody, and a reproducible bug report. `replaceState` and not
 * `pushState` — a builder that pushed a history entry per keystroke would take
 * a hundred presses of Back to leave.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { buildSheet, describeSheet } from "@/engine/sheets";
import { decodeSharedSheet, encodeSharedSheet } from "@/engine/sheets/share";
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

/**
 * What the fragment held when the page opened, if it held a sheet.
 *
 * Read once, on mount, and never again: the hook rewrites `#s=` on every change
 * from then on, so re-reading it would be reading its own handwriting.
 *
 * Test-built before it is trusted. `decodeSharedSheet` rebuilds the half of a
 * config every family shares and leaves each family's own fields alone, on the
 * grounds that a family already treats them as untrusted — so this is the belt
 * to that pair of braces, and the one place the promise in §14 ("fall back to
 * defaults rather than throwing") is actually kept.
 */
function fromHash(): { config: SheetConfig; seed: number } | null {
  if (typeof window === "undefined") return null;
  const match = /^#s=(.*)$/.exec(window.location.hash);
  if (!match) return null;

  const shared = decodeSharedSheet(match[1]);
  if (!shared) return null;

  try {
    // Both halves, because a family reaches into its own config twice: once to
    // make the page and once to say in a line what is on it. `services/sheets`
    // guards `describeSheet` for exactly this reason, and a bench that built
    // the paper and then threw on the caption would be no better than one that
    // threw on the paper.
    buildSheet(shared.config, shared.seed);
    describeSheet(shared.config);
  } catch {
    return null;
  }
  return shared;
}

export function useBuilder(): Builder {
  // Lazily, so the fragment is read once rather than on every render — and so
  // the very first paint is already the shared sheet rather than the default
  // one replaced a tick later.
  const [state, setState] = useState(() => {
    const shared = fromHash();
    return {
      config: shared?.config ?? defaultConfig(FIRST_SHEET),
      seed: shared?.seed ?? 1,
    };
  });
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
 * stopped rather than once per keystroke.
 *
 * §14 asks for this by name: a sheet of two hundred problems is cheap to build
 * and not free, and every generator here draws-and-rejects rather than
 * enumerating, so the cost is real at the top of a range. The controls
 * themselves are never debounced — a stepper that answered a sixth of a second
 * late would feel broken — only the paper is.
 */
export function useDebounced<T>(value: T, delay = REDRAW_DELAY): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
