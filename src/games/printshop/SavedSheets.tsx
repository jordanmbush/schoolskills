/**
 * My Sheets: the worksheets this household kept.
 *
 * There is no profile picker, and that is a decision rather than an omission: a
 * worksheet belongs to the household, not to a child (§15), so the sheet made
 * for the eldest is the sheet the next one gets.
 *
 * A saved sheet is a config and a seed, never any paper. `buildSheet` is
 * deterministic (§7), so a sheet kept in March prints the same problems in June.
 *
 * The list is here before anything is on the bench, because opening a saved
 * sheet is one way to start; the form to save one waits until there is a
 * sheet to save.
 */
import { useCallback, useEffect, useState } from "react";

import { Button, Field, Input } from "@/components/ui/kit";
import * as sheetService from "@/services/sheets";
import type { SavedSheet, SheetConfig } from "@/engine/sheets/types";

import type { SharedSheet } from "./useBuilder";

export function SavedSheets({
  sheet,
  onOpen,
}: {
  sheet: SharedSheet | null;
  onOpen: (config: SheetConfig, seed: number) => void;
}) {
  const [saved, setSaved] = useState<SavedSheet[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSaved(await sheetService.all());
      setError(null);
    } catch {
      // A browser blocking storage — private browsing does — is the usual
      // cause, and it is worth saying rather than showing an empty list that
      // looks like "you have never saved anything".
      setError("This browser isn't letting the site save anything.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    if (!sheet) return;
    try {
      // A blank name is not an error: the service names the sheet after what it
      // prints, which is a better default than anything a hurried parent types.
      await sheetService.create({ name, ...sheet });
      setName("");
      await refresh();
    } catch (err) {
      setError(
        err instanceof sheetService.InvalidSheet
          ? err.message
          : "Couldn't save that sheet.",
      );
    }
  };

  const forget = async (id: string) => {
    try {
      await sheetService.remove(id);
      await refresh();
    } catch {
      setError("Couldn't remove that sheet.");
    }
  };

  return (
    <div className="saved">
      {sheet ? (
        <div className="saved__form">
          <Field
            label="Save this one"
            hint="Kept on this device only. Nothing is uploaded."
            error={error ?? undefined}
          >
            <Input
              value={name}
              maxLength={sheetService.MAX_NAME}
              placeholder="Name it, or leave it blank"
              blurOnEnter
              onChange={setName}
            />
          </Field>
          <Button variant="accent" size="sm" onClick={() => void save()}>
            Save to my sheets
          </Button>
        </div>
      ) : (
        error && (
          <p className="saved__empty" role="alert">
            {error}
          </p>
        )
      )}

      {saved.length === 0 ? (
        <p className="saved__empty">
          Nothing saved yet. A saved sheet keeps its settings and its seed, so
          it prints the same page next week.
        </p>
      ) : (
        <ul className="saved__list">
          {saved.map((sheet) => (
            <li className="saved__item" key={sheet.id}>
              <span className="saved__name">{sheet.name}</span>
              <span className="saved__actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpen(sheet.config, sheet.seed)}
                >
                  Open
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void forget(sheet.id)}
                >
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
