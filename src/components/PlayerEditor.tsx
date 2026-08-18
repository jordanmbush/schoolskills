import { useEffect, useRef, useState } from "react";
import { useHub } from "@/components/state/HubContext";
import { sfx } from "@/services/sound";
import type { Profile } from "@/engine/types";
import { Button, Field, FieldSet, Input, Scrim } from "@/components/ui/kit";

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

  // `SyntheticEvent` rather than `FormEvent`, which React's own types now mark
  // deprecated on the grounds that it "doesn't actually exist" — a submit is a
  // plain synthetic event, and that is all this needs from it.
  async function save(event: React.SyntheticEvent) {
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
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "Add a player" : `Edit ${profile.name}`}
    >
      <Scrim onClose={onClose} label="Close without saving" />
      <form
        className="modal__panel panel anim-pop"
        onSubmit={save}
        style={{ "--accent": color } as React.CSSProperties}
      >
        <div className="panel__head">
          <h2 className="panel__title">
            {isNew ? "New player" : "Edit player"}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <Field label="Name">
          <Input
            ref={nameField}
            value={name}
            maxLength={24}
            onChange={setName}
            placeholder="Type a name"
            autoComplete="off"
          />
        </Field>

        <FieldSet legend="Avatar">
          <div className="picker picker--emoji">
            {AVATARS.map((option) => (
              <Button
                key={option}
                variant="bare"
                className={`picker__cell${option === emoji ? " is-chosen" : ""}`}
                onClick={() => {
                  setEmoji(option);
                  sfx.tap();
                }}
                pressed={option === emoji}
                aria-label={`Avatar ${option}`}
              >
                {option}
              </Button>
            ))}
          </div>
        </FieldSet>

        <FieldSet legend="Colour">
          <div className="picker picker--color">
            {COLORS.map((option) => (
              <Button
                key={option}
                variant="bare"
                className={`swatch${option === color ? " is-chosen" : ""}`}
                style={{ background: option }}
                onClick={() => {
                  setColor(option);
                  sfx.tap();
                }}
                pressed={option === color}
                aria-label={`Colour ${option}`}
              />
            ))}
          </div>
        </FieldSet>

        <FieldSet
          legend="Age"
          hint="Sets the default difficulty and how big everything looks."
        >
          <div className="stepper">
            <Button
              variant="bare"
              className="stepper__btn"
              onClick={() => setAge((a) => Math.max(3, a - 1))}
              aria-label="Younger"
            >
              −
            </Button>
            <span className="stepper__value u-mono">{age}</span>
            <Button
              variant="bare"
              className="stepper__btn"
              onClick={() => setAge((a) => Math.min(18, a + 1))}
              aria-label="Older"
            >
              +
            </Button>
          </div>
        </FieldSet>

        <div className="modal__actions">
          {!isNew &&
            (confirmingDelete ? (
              <div className="modal__confirm">
                <span>Remove {profile.name} and all their races?</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void remove()}
                  disabled={saving}
                >
                  Remove
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep
                </Button>
              </div>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmingDelete(true)}
              >
                Remove player
              </Button>
            ))}
          <Button
            type="submit"
            variant="accent"
            disabled={!name.trim() || saving}
          >
            {isNew ? "Add player" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
