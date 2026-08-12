import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as profileService from "@/services/profiles";
import * as sessionService from "@/services/sessions";
import { loadHub } from "@/services/hub";
import type { NewProfile } from "@/services/profiles";
import type { SessionDraft } from "@/services/sessions";
import { setSoundEnabled } from "@/services/sound";
import type { Profile, Session } from "@/engine/types";

type Toast = { id: number; message: string; tone: "good" | "bad" };

type HubValue = {
  profiles: Profile[];
  sessions: Session[];
  status: "loading" | "ready" | "error";
  error: string | null;
  reload: () => Promise<void>;
  createProfile: (profile: NewProfile) => Promise<Profile>;
  updateProfile: (id: string, patch: Partial<Profile>) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<void>;
  saveSession: (
    draft: SessionDraft,
  ) => Promise<{ session: Session; profile: Profile }>;
  notify: (message: string, tone?: Toast["tone"]) => void;
  toasts: Toast[];
};

const HubContext = createContext<HubValue | null>(null);

export function HubProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [status, setStatus] = useState<HubValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "good") => {
      const id = ++toastId.current;
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(
        () => setToasts((current) => current.filter((t) => t.id !== id)),
        3200,
      );
    },
    [],
  );

  const reload = useCallback(async () => {
    try {
      const state = await loadHub();
      setProfiles(state.profiles);
      setSessions(state.sessions);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Could not load saved progress",
      );
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createProfile = useCallback(async (profile: NewProfile) => {
    const created = await profileService.create(profile);
    setProfiles((current) => [...current, created]);
    return created;
  }, []);

  const updateProfile = useCallback(
    async (id: string, patch: Partial<Profile>) => {
      const updated = await profileService.update(id, patch);
      setProfiles((current) => current.map((p) => (p.id === id ? updated : p)));
      return updated;
    },
    [],
  );

  const deleteProfile = useCallback(async (id: string) => {
    await profileService.remove(id);
    setProfiles((current) => current.filter((p) => p.id !== id));
    setSessions((current) => current.filter((s) => s.profileId !== id));
  }, []);

  const saveSession = useCallback(async (draft: SessionDraft) => {
    const result = await sessionService.record(draft);
    setSessions((current) => [...current, result.session]);
    setProfiles((current) =>
      current.map((p) => (p.id === result.profile.id ? result.profile : p)),
    );
    return result;
  }, []);

  const value = useMemo<HubValue>(
    () => ({
      profiles,
      sessions,
      status,
      error,
      reload,
      createProfile,
      updateProfile,
      deleteProfile,
      saveSession,
      notify,
      toasts,
    }),
    [
      profiles,
      sessions,
      status,
      error,
      reload,
      createProfile,
      updateProfile,
      deleteProfile,
      saveSession,
      notify,
      toasts,
    ],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub() {
  const value = useContext(HubContext);
  if (!value) throw new Error("useHub must be used inside <HubProvider>");
  return value;
}

/** Resolves the :profileId route param and keeps theme + sound in sync with it. */
export function usePlayer(profileId: string | undefined) {
  const { profiles } = useHub();
  const player = profiles.find((p) => p.id === profileId) ?? null;

  useEffect(() => {
    const root = document.documentElement;
    if (!player) {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--ui-scale");
      return;
    }
    root.style.setProperty("--accent", player.color);
    // Younger players get bigger everything.
    root.style.setProperty(
      "--ui-scale",
      player.age <= 6 ? "1.14" : player.age <= 8 ? "1.07" : "1",
    );
    setSoundEnabled(player.soundOn !== false);
  }, [player]);

  return player;
}
