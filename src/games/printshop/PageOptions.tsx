/**
 * The options every sheet has, whatever is printed on it — §17's list, minus
 * whatever a family owns — in the sections the rail offers them under.
 *
 * `SheetOptions` in the engine is the same list, which is the point: these are
 * the fields no family owns, so they stay put while a parent tries three
 * families. Paper is even carried across a family change (see `setFamily`) —
 * somebody who has chosen A4 has chosen it about their printer, not about long
 * division.
 *
 * Three sections rather than one panel, because the rail shows one at a time:
 * the paper (size, which way up, margins, cut lines), the lettering (type size,
 * face, letter shapes) and the heading (title, instructions, the lines to fill
 * in). Answer boxes are the exception and go in the family's own tray, since a
 * box round the answer place is about the problems.
 */
import { Fragment } from "react";

import {
  Checkbox,
  Field,
  FieldSet,
  Input,
  NumberStepper,
  SegmentedControl,
  TextArea,
} from "@/components/ui/kit";
import { handOf } from "@/engine/sheets/hands";
import {
  formsOf,
  type Form,
  type Forms,
  type Hand,
} from "@/engine/sheets/hands/hand";
import { FONT_PT } from "@/engine/sheets/paper";
import { MAX_INSTRUCTIONS, MAX_TITLE } from "@/engine/sheets/share";
import type {
  HeaderField,
  MarginSize,
  Orientation,
  PaperSize,
  SheetFont,
} from "@/engine/sheets/types";

import { Choice, opt, type PanelProps } from "./options/parts";

const SIZES = [
  opt<PaperSize>("letter", "Letter"),
  opt<PaperSize>("a4", "A4"),
  opt<PaperSize>("legal", "Legal"),
];

const ORIENTATIONS = [
  opt<Orientation>("portrait", "Portrait"),
  opt<Orientation>("landscape", "Landscape"),
];

const MARGINS = [
  opt<MarginSize>("none", "None"),
  opt<MarginSize>("narrow", "Narrow"),
  opt<MarginSize>("normal", "Normal"),
  opt<MarginSize>("wide", "Wide"),
];

/**
 * Named by shape and never by a teaching model, because the models with names
 * are trademarks with per-seat fonts behind them (§6).
 *
 * Five is the last count `Choice` still draws as a row of pills — the threshold
 * is *past* five, not at it (`options/parts.tsx`) — so all five faces stay on
 * screen at once with their hints, which is what a list where two entries differ
 * by a detail worth reading needs. A sixth face would take the row to a dropdown
 * and the hints with it.
 */
const FONTS = [
  opt<SheetFont>("print", "Print", "single-storey a and g"),
  opt<SheetFont>("cursive", "Cursive, looped", "the traditional joined hand"),
  opt<SheetFont>(
    "cursive-modern",
    "Cursive, unlooped",
    "simpler shapes; the pencil lifts after b, f, g, j, p, q, s and y",
  ),
  opt<SheetFont>(
    "cursive-uk",
    "Cursive, fully joined",
    "lead-in strokes, and a join out of every letter",
  ),
  opt<SheetFont>("dyslexic", "Dyslexia", "weighted letters that can't mirror"),
];

/**
 * The forms of §25 as a parent reads them — a shape, never the name of the
 * scheme that teaches it, for the reason `FONTS` gives.
 */
const FORM_LABELS: Record<Form, string> = {
  single: "Single storey",
  double: "Double storey",
  curved: "Curved",
  straight: "Straight",
};

/** The three blanks a worksheet asks for, and the order they are printed in. */
const FIELDS: Array<{ id: HeaderField; label: string }> = [
  { id: "name", label: "Name" },
  { id: "date", label: "Date" },
  { id: "class", label: "Class" },
];

export function PaperOptions({ config, set }: PanelProps) {
  const paper = (patch: Partial<typeof config.paper>) =>
    set({ paper: { ...config.paper, ...patch } });

  return (
    <>
      <Choice
        label="Paper"
        value={config.paper.size}
        onChange={(size) => paper({ size })}
        options={SIZES}
      />
      <Choice
        label="Which way up"
        value={config.paper.orientation}
        onChange={(orientation) => paper({ orientation })}
        options={ORIENTATIONS}
      />
      <Choice
        label="Margins"
        value={config.paper.margin}
        onChange={(margin) => paper({ margin })}
        options={MARGINS}
      />
      <Checkbox
        label="Cut lines"
        hint="Dashed guides across the middle of the page, for a sheet you cut up."
        checked={config.cutLines === true}
        onChange={(cutLines) => set({ cutLines })}
      />
    </>
  );
}

export function LetteringOptions({ config, set }: PanelProps) {
  const hand = handOf(config.font);

  return (
    <>
      <FieldSet
        legend="Type size"
        hint="Points, as a type size is quoted on paper. Bigger type is an option here rather than something to zoom."
      >
        <NumberStepper
          label="Type size in points"
          value={config.fontPt}
          min={FONT_PT.min}
          max={FONT_PT.max}
          unit="pt"
          onChange={(fontPt) => set({ fontPt })}
        />
      </FieldSet>
      <Choice
        label="Face"
        value={config.font ?? "print"}
        onChange={(font) => set({ font })}
        options={FONTS}
        hint="Print is a single-storey a and g, the three cursive models are the joined hands different countries teach, and the dyslexia-friendly face has weighted letters that can't be mirrored. All five come with the sheet."
      />
      {hand && (
        <LetterShapes
          hand={hand}
          forms={config.forms}
          onChange={(forms) => set({ forms })}
        />
      )}
    </>
  );
}

export function HeadingOptions({ config, set }: PanelProps) {
  const toggleField = (id: HeaderField, on: boolean) =>
    set({
      // Rebuilt from the canonical order rather than pushed onto the end, so
      // ticking Class before Date still prints name, date, class.
      fields: FIELDS.map((field) => field.id).filter((field) =>
        field === id ? on : config.fields.includes(field),
      ),
    });

  return (
    <>
      <Field label="Title">
        <Input
          value={config.title ?? ""}
          maxLength={MAX_TITLE}
          placeholder="The family's own title"
          onChange={(title) => set({ title: title || undefined })}
        />
      </Field>
      <Field label="Instructions">
        <TextArea
          value={config.instructions ?? ""}
          maxLength={MAX_INSTRUCTIONS}
          rows={2}
          placeholder="One line, printed under the title"
          onChange={(instructions) =>
            set({ instructions: instructions || undefined })
          }
        />
      </Field>
      <FieldSet
        legend="Lines to fill in"
        hint="Printed blank and filled in with a pencil. Nothing here holds a child's name — there is nowhere in a sheet to put one."
      >
        <span className="pool">
          {FIELDS.map((field) => (
            <Checkbox
              key={field.id}
              label={field.label}
              checked={config.fields.includes(field.id)}
              onChange={(on) => toggleField(field.id, on)}
            />
          ))}
        </span>
      </FieldSet>
    </>
  );
}

export function AnswerBoxes({ config, set }: PanelProps) {
  return (
    <Checkbox
      label="Answer boxes"
      hint="A box round the answer place rather than a rule under it."
      checked={config.answerBox === true}
      onChange={(answerBox) => set({ answerBox })}
    />
  );
}

/**
 * One row per letter the hand draws more than one way, in the hand's own
 * order, with the hand's own shape offered first.
 *
 * A choice of the hand's own shape is written as no entry, and a sheet with no
 * entries left carries no `forms` at all: absent already means "as the hand
 * draws it" (§25), so writing the default down would only lengthen every share
 * URL. A saved form the hand does not draw for that letter shows as the hand's
 * own, which is what the row prints.
 */
function LetterShapes({
  hand,
  forms = {},
  onChange,
}: {
  hand: Hand;
  forms?: Forms;
  onChange: (forms: Forms | undefined) => void;
}) {
  const lettered = Object.keys(hand.glyphs).filter(
    (letter) => formsOf(hand, letter).length > 0,
  );
  if (lettered.length === 0) return null;

  const choose = (letter: string, form: Form) => {
    const next: Forms = { ...forms };
    if (form === formsOf(hand, letter)[0]) delete next[letter];
    else next[letter] = form;
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  return (
    <FieldSet
      legend="Letter shapes"
      hint="The shapes schools differ on. Pick the ones your child is taught."
    >
      <div className="shapes">
        {lettered.map((letter) => {
          const offered = formsOf(hand, letter);
          const chosen = forms[letter];
          return (
            <Fragment key={letter}>
              <span className="shapes__letter" aria-hidden="true">
                {letter}
              </span>
              <SegmentedControl
                label={letter}
                value={chosen && offered.includes(chosen) ? chosen : offered[0]}
                onChange={(form) => choose(letter, form)}
                options={offered.map((form) => opt(form, FORM_LABELS[form]))}
                slim
              />
            </Fragment>
          );
        })}
      </div>
    </FieldSet>
  );
}
