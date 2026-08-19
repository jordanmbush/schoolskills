import { SegmentedControl, type SegmentedOption } from "@/components/ui/kit";
import type { KeyboardMode } from "@/engine/types";

/**
 * Choosing how much of the keyboard is on screen (docs/typing.md §4.2).
 *
 * The board itself is deliberately inert — sixty `<span>`s, `aria-hidden`,
 * nothing to press, because a tappable keyboard is a hunt-and-peck trainer
 * (§4.5). This is the opposite case and it is why the two live side by side:
 * *this* is a control, so it is a real kit primitive with a name, a role and
 * arrow keys, and not a row of `<Button pressed>` dressed as one.
 *
 * ── Three pills, because there are three modes ────────────────────────────
 * `SegmentedControl` rather than a `Toggle`: a switch can only say on or off,
 * and the whole point of `KeyboardMode` is that "board without the hint" is a
 * real place to stand between the two (§4.1). It is the rung a child climbs
 * before turning the board off entirely, and it is where most of the learning
 * happens — so it cannot be the thing you reach by unchecking half a pair.
 *
 * ── Its own component, and its own defaulting ─────────────────────────────
 * `mode` is the profile's raw optional field, not a resolved one, so the
 * fallback to "guide" lives here — one resolver, exported, rather than a copy
 * of it at each caller. That is also what makes the cases that matter testable
 * without a database or a router: a profile saved before this shipped has no
 * `keyboard` key at all, and a restored backup can carry a value no version of
 * this app ever wrote. Either one must land on "guide" rather than on nothing
 * selected. `KeyboardSetting.test.tsx` is that test.
 */

/**
 * What a player who has never chosen gets.
 *
 * "guide" rather than "off" because the two mistakes are not the same size:
 * showing the hint to a child who didn't need it costs a glance, and hiding it
 * from a child who did costs a downward look at the real keyboard — which is
 * the habit this whole world exists to prevent, and it sets in fast.
 */
export const DEFAULT_KEYBOARD_MODE: KeyboardMode = "guide";

/**
 * Named for what a child sees, not for what the field is called. The hints do
 * the explaining, because "Keys" and "Guide" only differ in a way you can
 * describe — one draws the board, the other also points at the next key.
 */
const OPTIONS: SegmentedOption<KeyboardMode>[] = [
  { value: "off", label: "Off", hint: "No keyboard" },
  { value: "keys", label: "Keys", hint: "Show the board" },
  { value: "guide", label: "Guide", hint: "Show the next key" },
];

/**
 * What a profile's `keyboard` field actually means, for a field that may hold
 * something else entirely.
 *
 * Not `mode ?? DEFAULT_KEYBOARD_MODE`, because `??` only catches an absent
 * field and absent is not the only bad state. `Profile` is deliberately not
 * read-migrated (docs/typing.md §10), and a restored backup is written into
 * the store exactly as the file had it (`services/storage/db.ts`, driven by
 * `services/hub.ts#importAll`) — so a hand-edited record reaches this
 * component with a `keyboard` the type says is impossible. Handed straight to
 * `SegmentedControl`, that draws a radiogroup with no pill checked: a child
 * looking at a setting that claims to be on none of its three settings.
 *
 * Resolved against `OPTIONS` rather than against a second copy of the three
 * mode names, so what comes back is by construction a pill that exists.
 *
 * Exported because the race reads the same field to decide what to draw
 * (`TypingTrack`, #134), and the two must agree: a setting whose pills say
 * "guide" over a run with no board is worse than either alone. One resolver,
 * so there is nothing for a second read site to disagree with.
 */
export const keyboardMode = (mode?: KeyboardMode): KeyboardMode =>
  OPTIONS.find((option) => option.value === mode)?.value ??
  DEFAULT_KEYBOARD_MODE;

export function KeyboardSetting({
  mode,
  onChange,
}: {
  /**
   * `Profile.keyboard` as it comes out of storage — absent on every profile
   * made before this shipped, and on every one whose player hasn't chosen.
   * Typed as the union, but storage is the one place that promise isn't kept;
   * `selected` is what makes it true again.
   */
  mode?: KeyboardMode;
  onChange: (next: KeyboardMode) => void;
}) {
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
        options={OPTIONS}
      />
    </div>
  );
}
