import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { ToastRail } from "@/components/ToastRail";
import { AdSlot } from "@/components/site/AdSlot";
import { HubProvider, useHub } from "@/components/state/HubContext";
import { RaceProvider } from "@/components/state/RaceContext";
import { Button } from "@/components/ui/kit";
import PlayerSelect from "@/components/screens/PlayerSelect";

import TypingSetup from "./TypingSetup";
import TypingTrack from "./TypingTrack";
import TypingResults from "./TypingResults";
import StormRun from "./storm/StormRun";

/**
 * The typing game, as its own island.
 *
 * A separate island rather than another deck inside the flash-card game,
 * because the interaction really is different: no discrete cards to submit, no
 * choice of input mode, no per-card clock, and a passage that has to stay on
 * screen while you type through it. Everything that ISN'T different is shared
 * — `@/games/race` for the clock, the lane and the finish, `HubProvider` for
 * the profiles.
 *
 * Same origin, so a player's profile, XP, badges and record book follow them
 * here from `/flash-cards` with nothing to sign into. That is the whole reason
 * games are paths and not subdomains; see CLAUDE.md.
 *
 * Routes are flatter than the flash-card island's: there's one game here, so
 * `/p/:id` is the setup screen rather than a hub in front of it.
 */

function Shell() {
  const { status, error, reload } = useHub();

  if (status === "loading") {
    return (
      <div className="boot">
        <p className="u-eyebrow">School Skills</p>
        <p className="boot__msg">Loading saved progress…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="boot">
        <p className="u-eyebrow">School Skills</p>
        <h1 className="u-display boot__title">
          Can&apos;t open saved progress
        </h1>
        <p className="boot__msg">{error}</p>
        <p className="boot__hint">
          This usually means the browser is blocking storage — private browsing
          can do that. Progress is only ever saved on this device, so
          there&apos;s nothing to recover from elsewhere.
        </p>
        <Button variant="go" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <RaceProvider>
      {/* Above everything, on every screen including a live race. Its height is
          reserved in CSS at first paint and subtracted from the viewport by
          `--ad-h`, so it cannot move the card or the keypad whenever it fills —
          see src/styles/ads.css. Placed at the top of the island because that
          is the furthest point in the layout from the answer controls. */}
      <AdSlot name="game" className="ad--game" />
      <Routes>
        <Route path="/" element={<PlayerSelect />} />
        <Route path="/p/:profileId" element={<TypingSetup />} />
        <Route path="/p/:profileId/go" element={<TypingTrack />} />
        {/* Hailstorm (docs/typing.md §9). Its own route rather than a mode of
            `/go`, because it shares none of that screen's machinery — no
            passage, no input, no ghost — and all of its own. The lesson is in
            the path because a storm is a rung of the ladder: twenty levels,
            one route, and the tile a child pressed is what says which. A
            `lessonId` that names no storm goes back to the ladder rather than
            opening an empty sky (`StormRun`). */}
        <Route path="/p/:profileId/storm/:lessonId" element={<StormRun />} />
        <Route path="/p/:profileId/results" element={<TypingResults />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastRail />
    </RaceProvider>
  );
}

export default function TypingApp() {
  return (
    <HashRouter>
      <HubProvider>
        <Shell />
      </HubProvider>
    </HashRouter>
  );
}
