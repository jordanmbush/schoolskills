import type { ReactNode } from "react";

/**
 * A labelled form row: label, control, optional hint, optional inline error.
 *
 * `Field` wraps its control in a `<label>`, so the association is structural —
 * no `htmlFor`/`id` pair to keep in sync, and nothing to forget. That only
 * works for a single control, which is why `FieldSet` below exists for groups.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {/* Spans, not paragraphs: a <label> may only contain phrasing content.
          `.field` is a grid, so they stack the same either way. */}
      {hint ? <span className="field__hint">{hint}</span> : null}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

/**
 * The same row for a *group* of controls — an avatar picker, a colour picker,
 * a stepper. A `<label>` can only point at one control, so a group needs
 * `<fieldset>`/`<legend>` to be announced as one named thing.
 */
export function FieldSet({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="field">
      <legend className="field__label">{legend}</legend>
      {children}
      {hint ? <p className="field__hint">{hint}</p> : null}
    </fieldset>
  );
}
