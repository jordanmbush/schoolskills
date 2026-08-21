import { useEffect, useRef, useState } from "react";
import { useHub } from "@/components/state/HubContext";
import { sfx } from "@/services/sound";
import type { Profile } from "@/engine/types";
import { Button, Field, FieldSet, Input, Scrim } from "@/components/ui/kit";

/**
 * The faces on offer, and the order a new player's default is taken from.
 *
 * The default rotates on how many players already exist, so the second child
 * in a house isn't handed the first child's fox. On the picker the face and
 * the colour are the whole of how a five-year-old finds their own card.
 */
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

/**
 * Rotated the same way, and not only a swatch: `usePlayer` writes the chosen
 * one to `--accent`, so it becomes the colour of the whole app while that
 * player is in it.
 */
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
  /**
   * The player being edited, or `null` for a new one. Callers hold a third
   * state — `undefined`, meaning no dialog at all — which is why this is
   * `Profile | null` rather than optional.
   */
  profile: Profile | null;
  onClose: () => void;
  onDeleted?: () => void;
};

/**
 * Add or edit a player, in one dialog.
 *
 * **The form pre-empts two of the three name rules and cannot pre-empt the
 * third.** `services/profiles.ts` wants a name that is non-empty once trimmed,
 * no longer than 24 characters, and not already taken by someone else in the
 * house (compared without case). The first two are held here — Save stays
 * disabled on an empty box, `maxLength` stops the 25th character — so a child
 * never meets an error for them. A clash can only be answered by reading
 * storage, so it arrives as a thrown `InvalidInput` and `save` shows that
 * message verbatim: the service names who already has the name, where a
 * generic "Could not save" would leave a child guessing.
 *
 * The age stepper's 3 to 18 is the same range that service validates. Widen
 * one and the other has to move with it, or − and + start offering a value the
 * save then rejects.
 */
export default function PlayerEditor({ profile, onClose, onDeleted }: Props) {
  const { createProfile, updateProfile, deleteProfile, profiles, notify } =
    useHub();
  const isNew = profile === null;
  const [name, setName] = useState(profile?.name ?? "");
  const [emoji, setEmoji] = useState(
    profile?.emoji ?? AVATARS[profiles.length % AVATARS.length],
  );
  // Previewed live: the form below carries its own `--accent`, so the Save
  // button and the focus rings take this colour before it is saved. The root
  // holds the saved one (`usePlayer`), which is what makes closing without
  // saving leave nothing behind.
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
      // Cleared only on the way that stays on screen. A save that worked has
      // already closed the dialog, so there is nothing left to hand the
      // buttons back to; a save that failed has to, because the name that
      // caused it is still in the box waiting to be fixed.
      setSaving(false);
    }
  }

  // `deleteProfile` cascades: the races go with the player, and IndexedDB
  // holds the only copy of them. That is what the confirmation below is
  // naming, rather than asking "are you sure?" about something unstated.
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
