import { useState } from "react";

import { useHub } from "@/components/state/HubContext";
import { Button, FilePicker } from "@/components/ui/kit";
import { exportAll, importAll, type Backup } from "@/services/hub";
import { sfx } from "@/services/sound";

/**
 * Backup and restore.
 *
 * With no accounts and no server, a downloaded file is the ONLY way progress
 * moves between devices — and the only insurance against someone clearing site
 * data. That makes this a core feature rather than a settings-page nicety, so
 * it sits on the profile picker where a parent will actually find it.
 *
 * Restore merges by default. Ids are preserved on both sides, so re-importing
 * the same file is idempotent rather than duplicating every run.
 */
export default function BackupPanel() {
  const { profiles, sessions, decks, reload, notify } = useHub();
  const [busy, setBusy] = useState(false);

  async function download() {
    sfx.tap();
    const backup = await exportAll();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `school-skills-${backup.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify(
      `Saved ${profiles.length} players, ${sessions.length} races` +
        (decks.length ? ` and ${decks.length} word lists` : ""),
    );
  }

  async function restore(file: File) {
    setBusy(true);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      // Validate before writing. A half-recognised file that imports anyway is
      // worse than one that refuses: it silently mixes junk into real history.
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !Array.isArray((parsed as Backup).profiles) ||
        !Array.isArray((parsed as Backup).sessions)
      ) {
        throw new Error("That doesn't look like a School Skills backup");
      }
      const backup = parsed as Backup;
      const added = await importAll(backup, "merge");
      await reload();
      sfx.record();
      notify(
        `Restored ${added.profiles} players, ${added.sessions} races` +
          (added.decks ? ` and ${added.decks} word lists` : ""),
      );
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not read that file",
        "bad",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backup">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void download()}
        disabled={busy || profiles.length === 0}
      >
        ⬇ Back up progress
      </Button>
      <FilePicker onFile={(file) => void restore(file)}>
        ⬆ Restore from a backup
      </FilePicker>
      <p className="backup__note">
        Progress is saved on this device only. A backup file is how it moves to
        another one — and how you get it back if this browser is ever cleared.
      </p>
    </div>
  );
}
