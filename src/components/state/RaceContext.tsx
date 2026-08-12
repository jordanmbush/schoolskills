import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FlashConfig, Ghost, Profile, Session } from "@/engine/types";

export type PendingRace = {
  profileId: string;
  config: FlashConfig;
  /** Shared with the ghost so both runs cover the same cards in the same order. */
  seed: number;
  ghost: Ghost | null;
};

export type RaceOutcome = {
  session: Session;
  profileAfter: Profile;
  ghost: Ghost | null;
  personalRecord: boolean;
  /** The run this one was measured against, if there was one. */
  previousBest: Session | null;
  newBadges: string[];
  bonuses: Array<{ label: string; xp: number }>;
  levelledUpTo: number | null;
};

type RaceValue = {
  pending: PendingRace | null;
  outcome: RaceOutcome | null;
  start: (race: PendingRace) => void;
  finish: (outcome: RaceOutcome) => void;
  clear: () => void;
};

const RaceContext = createContext<RaceValue | null>(null);

/**
 * Race state lives in memory only: a mid-race refresh should drop you back at
 * setup rather than resume a run whose clock kept ticking.
 */
export function RaceProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingRace | null>(null);
  const [outcome, setOutcome] = useState<RaceOutcome | null>(null);

  const value = useMemo<RaceValue>(
    () => ({
      pending,
      outcome,
      start: (race) => {
        setOutcome(null);
        setPending(race);
      },
      finish: (result) => {
        setPending(null);
        setOutcome(result);
      },
      clear: () => {
        setPending(null);
        setOutcome(null);
      },
    }),
    [pending, outcome],
  );

  return <RaceContext.Provider value={value}>{children}</RaceContext.Provider>;
}

export function useRace() {
  const value = useContext(RaceContext);
  if (!value) throw new Error("useRace must be used inside <RaceProvider>");
  return value;
}
