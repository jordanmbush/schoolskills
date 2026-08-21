import { SegmentedControl, type SegmentedOption } from "@/components/ui/kit";
import type { KeyboardMode } from "@/engine/types";

/**
 * Choosing how much of the keyboard is on screen (§4.2).
 *
 * The board itself is inert and `aria-hidden` (§4.4, §4.5); *this* is a
 * control, so it is a real kit primitive with a name, a role and arrow keys,
 * and not a row of `<Button pressed>` dressed as one.
 *
 * `SegmentedControl` rather than a `Toggle`, because there are three modes and
 * "board without the hint" is a real place to stand between the two (§4.1) —
 * not somewhere you arrive by unchecking half a pair.
 *
 * `mode` is the profile's raw optional field, not a resolved one, so the
 * fallback lives here: one resolver, exported, rather than a copy of it at each
 * caller.
 *
 * Two homes, and only one of them saves. On the free-play panel this writes
 * straight through to the profile; in the lesson brief it is seeded by the
 * lesson and governs that run alone (`lessonKeyboard.ts`). The component does
 * not know the difference — it renders a mode and reports a change — which is
 * what keeps the two screens showing one control instead of two that look
 * alike.
 */

/** What a player who has never chosen gets — "guide", and why (§4.2). */
export const DEFAULT_KEYBOARD_MODE: KeyboardMode = "guide";

/**
 * Named for what a child sees, not for what the field is called. The hints do
 * the explaining, because "Keys" and "Guide" differ only in a way you can
 * describe.
 */
const OPTIONS: SegmentedOption<KeyboardMode>[] = [
  { value: "off", label: "Off", hint: "No keyboard" },
  { value: "keys", label: "Keys", hint: "Show the board" },
  { value: "guide", label: "Guide", hint: "Show the next key" },
];

/** The same three pills with nothing to press, built once rather than per render. */
const LOCKED: SegmentedOption<KeyboardMode>[] = OPTIONS.map((option) => ({
  ...option,
  disabled: true,
}));

/**
 * What a profile's `keyboard` field actually means, for a field that may hold
 * something else entirely.
 *
 * Not `mode ?? DEFAULT_KEYBOARD_MODE`, because `??` only catches an absent
 * field and absent is not the only bad state. `Profile` is deliberately not
 * read-migrated (§10), and a restored backup is written into the store exactly
 * as the file had it (`services/storage/db.ts`, driven by
 * `services/hub.ts#importAll`) — so a hand-edited record reaches this component
 * with a `keyboard` the type says is impossible. Handed straight to
 * `SegmentedControl`, that draws a radiogroup with no pill checked.
 *
 * Resolved against `OPTIONS` rather than against a second copy of the three
 * mode names, so what comes back is by construction a pill that exists.
 *
 * Exported because the race reads the same field to decide what to draw
 * (`TypingTrack`), and the two must agree: a setting whose pills say "guide"
 * over a run with no board is worse than either alone.
 */
export const keyboardMode = (mode?: KeyboardMode): KeyboardMode =>
  OPTIONS.find((option) => option.value === mode)?.value ??
  DEFAULT_KEYBOARD_MODE;

export function KeyboardSetting({
  mode,
  onChange,
  lockedBecause,
}: {
  /**
   * `Profile.keyboard` as it comes out of storage — absent on every profile
   * made before this shipped, and on every one whose player hasn't chosen.
   * Typed as the union, but storage is the one place that promise isn't kept;
   * `keyboardMode` is what makes it true again.
   */
  mode?: KeyboardMode;
  onChange: (next: KeyboardMode) => void;
  /**
   * Why this run's keyboard cannot be changed, on the lessons that insist
   * (§4.2). Absent everywhere else, which is free play and every unlocked
   * lesson.
   *
   * A sentence rather than a `disabled` flag, because a control that can be
   * greyed out without saying why is a control that will be. The pills still
   * show which mode the run is in.
   */
  lockedBecause?: string | null;
}) {
  const locked = Boolean(lockedBecause);

  return (
    <div className="control">
      {/* A span, not a `<label>`: the group's accessible name comes from
          `SegmentedControl`'s own `aria-label`, and a second label pointing at
          a radiogroup would announce it twice. This one is for the eye. */}
      <span className="control__label">Keyboard</span>
      <SegmentedControl
        label="Keyboard"
        value={keyboardMode(mode)}
        onChange={onChange}
        options={locked ? LOCKED : OPTIONS}
      />
      {/* Under the pills, in reading order, because a disabled radiogroup has
          no focus stop left to hang a description on — every input in it is
          `disabled`, so nothing in the group can be tabbed to and told. */}
      {lockedBecause && <p className="control__why muted">{lockedBecause}</p>}
    </div>
  );
}
