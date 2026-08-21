import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { ToastRail } from "@/components/ToastRail";
import { AdSlot } from "@/components/site/AdSlot";
import { HubProvider, useHub } from "@/components/state/HubContext";
import { RaceProvider } from "@/components/state/RaceContext";
import {
  SUBJECTS,
  SubjectProvider,
  type SubjectId,
} from "@/components/state/SubjectContext";
import { Button } from "@/components/ui/kit";
import PlayerSelect from "@/components/screens/PlayerSelect";
import PlayerHub from "@/components/screens/PlayerHub";
import Progress from "@/components/screens/Progress";

import RaceSetup from "./RaceSetup";
import RaceTrack from "./RaceTrack";
import RaceResults from "./RaceResults";

/**
 * The game, as a single React island inside a static page.
 *
 * ── Why HashRouter ──────────────────────────────────────────────────────────
 * The origin is S3 behind CloudFront: there is no server to rewrite
 * `/flash-cards/p/abc/race` back to an HTML file, so a real path router would
 * 404 on refresh and on every shared deep link. The alternatives were a
 * CloudFront rewrite function (more infra, and it would have to not swallow
 * genuine 404s) or prerendering every route (impossible — profile ids are
 * created on the player's own device and exist nowhere at build time).
 *
 * Hash routes cost nothing here. Everything below the entry screen is behind
 * interaction and profile-specific, so none of it was ever going to be
 * crawled; the crawlable surface is the Astro pages around this island, and
 * they keep clean paths. In exchange every `Link`, `useNavigate` and
 * `useParams` in the ported screens works untouched, and the back button
 * behaves the way a parent expects.
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
    // Reaching here means the browser refused storage (private windows in
    // some browsers block IndexedDB) or the database failed to open. There is
    // no server to be down, so say that rather than sending someone hunting
    // for a terminal.
    return (
      <div className="boot">
        <p className="u-eyebrow">School Skills</p>
        <h1 className="u-display boot__title">
          Can&apos;t open saved progress
        </h1>
        <p className="boot__msg">{error}</p>
        <p className="boot__hint">
          This usually means the browser is blocking storage — private browsing
          can do that. Progress is only ever saved on this device, so there's
          nothing to recover from elsewhere.
        </p>
        <Button variant="go" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <RaceProvider>
      {/* Above everything, on every screen including a live race — the
          furthest point in the layout from the answer controls. See
          `AdSlot` for why filling it cannot move the card. */}
      <AdSlot name="game" className="ad--game" />
      <Routes>
        <Route path="/" element={<PlayerSelect />} />
        <Route path="/p/:profileId" element={<PlayerHub />} />
        <Route path="/p/:profileId/progress" element={<Progress />} />
        <Route path="/p/:profileId/race" element={<RaceSetup />} />
        <Route path="/p/:profileId/race/go" element={<RaceTrack />} />
        <Route path="/p/:profileId/race/results" element={<RaceResults />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastRail />
    </RaceProvider>
  );
}

/**
 * Mounted twice, at `/flash-cards` and at `/spelling/play`, with `subject`
 * deciding which decks exist inside. See `SubjectContext` for why both mounts
 * are one origin, which matters more than the routing does.
 */
export default function FlashCardsApp({
  subject = "numbers",
}: {
  subject?: SubjectId;
}) {
  return (
    <HashRouter>
      <SubjectProvider subject={SUBJECTS[subject]}>
        <HubProvider>
          <Shell />
        </HubProvider>
      </SubjectProvider>
    </HashRouter>
  );
}
