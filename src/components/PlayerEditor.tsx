import { useEffect, useRef, useState } from "react";
import { useHub } from "@/components/state/HubContext";
import { sfx } from "@/services/sound";
import type { Profile } from "@/engine/types";
import { Scrim } from "@/components/ui/kit";

export const AVATARS = [
  "🦊",
  "🐼",
  "🦖",
  "🐙",
  "🦄",
  "🐝",
  "🦁",
  "🐢",
  "🐳",
  "🦉",
  "🐸",
  "🦋",
  "🚀",
  "⚡",
  "🌟",
  "🍕",
  "🎸",
  "🏀",
  "🐧",
  "🦈",
  "🌈",
  "🍄",
  "👾",
  "🐉",
];

export const COLORS = [
  "#4cc4ff",
  "#c8ff41",
  "#ffc53d",
  "#ff4d6d",
  "#a78bfa",
  "#34d399",
  "#fb923c",
  "#f472b6",
];

type Props = {
  profile: Profile | null;
  onClose: () => void;
  onDeleted?: () => void;
};

export default function PlayerEditor({ profile, onClose, onDeleted }: Props) {
  const { createProfile, updateProfile, deleteProfile, profiles, notify } =
    useHub();
  const isNew = profile === null;
  const [name, setName] = useState(profile?.name ?? "");
  const [emoji, setEmoji] = useState(
    profile?.emoji ?? AVATARS[profiles.length % AVATARS.length],
  );
  const [color, setColor] = useState(
    profile?.color ?? COLORS[profiles.length % COLORS.length],
  );
  const [age, setAge] = useState(profile?.age ?? 8);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameField.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      if (isNew) {
        await createProfile({ name: name.trim(), emoji, color, age });
        notify(`${name.trim()} is ready to race`);
      } else {
        await updateProfile(profile.id, {
          name: name.trim(),
          emoji,
          color,
          age,
        });
        notify("Saved");
      }
      sfx.select();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save", "bad");
      setSaving(false);
    }
  }

  async function remove() {
    if (!profile) return;
    setSaving(true);
    try {
      await deleteProfile(profile.id);
      notify(`${profile.name} was removed`);
      onDeleted?.();
      onClose();
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not remove player",
        "bad",
      );
      setSaving(false);
    }
  }

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "Add a player" : `Edit ${profile.name}`}
    >
      <Scrim onClose={onClose} label="Close without saving" />
      <form
        className="sheet__panel panel anim-pop"
        onSubmit={save}
        style={{ "--accent": color } as React.CSSProperties}
      >
        <div className="panel__head">
          <h2 className="panel__title">
            {isNew ? "New player" : "Edit player"}
          </h2>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <label className="field">
          <span className="field__label">Name</span>
          <input
            ref={nameField}
            className="field__input"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type a name"
            autoComplete="off"
          />
        </label>

        <fieldset className="field">
          <legend className="field__label">Avatar</legend>
          <div className="picker picker--emoji">
            {AVATARS.map((option) => (
              <button
                key={option}
                type="button"
                className={`picker__cell${option === emoji ? " is-chosen" : ""}`}
                onClick={() => {
                  setEmoji(option);
                  sfx.tap();
                }}
                aria-pressed={option === emoji}
                aria-label={`Avatar ${option}`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Colour</legend>
          <div className="picker picker--color">
            {COLORS.map((option) => (
              <button
                key={option}
                type="button"
                className={`swatch${option === color ? " is-chosen" : ""}`}
                style={{ background: option }}
                onClick={() => {
                  setColor(option);
                  sfx.tap();
                }}
                aria-pressed={option === color}
                aria-label={`Colour ${option}`}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Age</legend>
          <div className="stepper">
            <button
              type="button"
              className="stepper__btn"
              onClick={() => setAge((a) => Math.max(3, a - 1))}
              aria-label="Younger"
            >
              −
            </button>
            <span className="stepper__value u-mono">{age}</span>
            <button
              type="button"
              className="stepper__btn"
              onClick={() => setAge((a) => Math.min(18, a + 1))}
              aria-label="Older"
            >
              +
            </button>
          </div>
          <p className="field__hint">
            Sets the default difficulty and how big everything looks.
          </p>
        </fieldset>

        <div className="sheet__actions">
          {!isNew &&
            (confirmingDelete ? (
              <div className="sheet__confirm">
                <span>Remove {profile.name} and all their races?</span>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => void remove()}
                  disabled={saving}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => setConfirmingDelete(true)}
              >
                Remove player
              </button>
            ))}
          <button
            type="submit"
            className="btn btn--accent"
            disabled={!name.trim() || saving}
          >
            {isNew ? "Add player" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
