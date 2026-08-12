import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Profile } from "@/engine/types";

/**
 * `@/components/ui/kit` is the kit's single import path — every feature file
 * already imports from here, so the form primitives are re-exported rather
 * than given their own paths. They live in their own modules because each one
 * carries a real doc block and this file has a 300-line cap to respect.
 */
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./Button";
export { Input, type InputProps } from "./Input";
export { Field, FieldSet } from "./Field";
export { Select, type SelectOption, type SelectProps } from "./Select";

export function Avatar({
  profile,
  size = "3.5rem",
}: {
  profile: Profile;
  size?: string;
}) {
  return (
    <span
      className="avatar"
      style={
        {
          "--avatar-size": size,
          "--tint": profile.color,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {profile.emoji}
    </span>
  );
}

/**
 * Prop-driven on purpose: the kit may not import `levelFromXp` (that's a
 * domain rule), so the caller computes the level and hands it over. Same
 * pixels, one less dependency pointing the wrong way.
 */
export function LevelRing({
  level,
  progress,
  tint,
  size = "5.5rem",
}: {
  level: number;
  progress: number;
  tint: string;
  size?: string;
}) {
  return (
    <div
      className="ring"
      style={
        {
          "--ring-size": size,
          "--ring-progress": progress,
          "--tint": tint,
        } as React.CSSProperties
      }
      role="img"
      aria-label={`Level ${level}, ${Math.round(progress * 100)}% to the next level`}
    >
      <span className="ring__inner">
        <span className="ring__level">{level}</span>
        <span className="ring__label">Level</span>
      </span>
    </div>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}

const CONFETTI_COLORS = [
  "#c8ff41",
  "#4cc4ff",
  "#ffc53d",
  "#ff4d6d",
  "#a78bfa",
  "#e9eff7",
];

/** Change `burst` to fire a new volley. Skipped entirely for reduced motion. */
export function Confetti({
  burst,
  count = 90,
}: {
  burst: number;
  count?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const bits = useMemo(() => {
    if (burst === 0 || reduced) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: `${burst}-${i}`,
      left: `${Math.random() * 100}%`,
      drift: `${(Math.random() - 0.5) * 42}vw`,
      spin: `${Math.random() * 1080 - 540}deg`,
      dur: `${2.1 + Math.random() * 1.6}s`,
      delay: `${Math.random() * 0.5}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      wide: Math.random() > 0.7,
    }));
  }, [burst, count, reduced]);

  if (bits.length === 0) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((bit) => (
        <span
          key={bit.id}
          className="confetti__bit"
          style={
            {
              left: bit.left,
              background: bit.color,
              "--drift": bit.drift,
              "--spin": bit.spin,
              "--dur": bit.dur,
              "--delay": bit.delay,
              width: bit.wide ? "16px" : "8px",
              height: bit.wide ? "8px" : "18px",
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * The dimmed backdrop behind a sheet, as a real control.
 *
 * It was a <div onClick> in the original, which is mouse-only: no focus, no
 * Enter/Space, invisible to a screen reader. Rendering a button gives all of
 * that for free — and since the kit is the one place native controls belong,
 * the feature code loses a raw <button> too.
 */
export function Scrim({
  onClose,
  label = "Close",
}: {
  onClose: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="sheet__scrim"
      aria-label={label}
      onClick={onClose}
    />
  );
}

/**
 * A file chooser that looks like the rest of the buttons.
 *
 * The native control can't be styled, so the real <input> is visually hidden
 * and a <label> provides the surface — the standard accessible pattern, and it
 * keeps click-to-open and keyboard focus working without a click handler
 * forwarding to a ref. Resets the value after each pick so choosing the same
 * file twice still fires a change event.
 */
export function FilePicker({
  onFile,
  accept = "application/json",
  children,
}: {
  onFile: (file: File) => void;
  accept?: string;
  children: ReactNode;
}) {
  return (
    <label className="btn btn--ghost btn--sm filepicker">
      <input
        type="file"
        accept={accept}
        className="filepicker__input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      {children}
    </label>
  );
}
