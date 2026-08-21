/**
 * The forms: which one, and how much room to answer in. Short for the reason the
 * shelf exists — a blank form has no content to configure.
 *
 * The prompt box is the one control here that changes what is *on* the page, and
 * it is deliberately allowed to be empty: leaving it blank is how a parent asks
 * for one out of the bank, which is drawn by the seed, so "give me another" is
 * the Another Sheet button rather than a second control (§7).
 */
import { Field, FieldSet, NumberStepper, TextArea } from "@/components/ui/kit";
import {
  FORM_SPACE,
  MAX_FORM_ROWS,
  isListForm,
} from "@/engine/sheets/templates/forms";
import { MAX_INSTRUCTIONS } from "@/engine/sheets/share";
import type { FormConfig, FormStyle } from "@/engine/sheets/types";

import { Choice, opt, type PanelProps } from "./parts";

/**
 * The nine, grouped in the order a week uses them rather than alphabetically:
 * what was read, what was written about it, what was done, and when it happened.
 */
const STYLES = [
  opt<FormStyle>("reading-log", "Reading log"),
  opt<FormStyle>("book-report", "Book report"),
  opt<FormStyle>("story-map", "Story map"),
  opt<FormStyle>("paragraph-frame", "Paragraph frame"),
  opt<FormStyle>("writing-prompt", "Writing prompt"),
  opt<FormStyle>("lab-report", "Lab report"),
  opt<FormStyle>("scientific-method", "Scientific method"),
  opt<FormStyle>("observation-journal", "Observation journal"),
  opt<FormStyle>("timeline", "Timeline"),
];

export function FormsPanel({ config, set }: PanelProps<FormConfig>) {
  return (
    <>
      <Choice
        label="Which form"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />

      {isListForm(config.style) && (
        <FieldSet legend="Rows" hint="Capped at what fits on the page.">
          <NumberStepper
            label="Rows"
            value={config.rows ?? 14}
            min={1}
            max={MAX_FORM_ROWS}
            onChange={(rows) => set({ rows })}
          />
        </FieldSet>
      )}

      {config.style === "writing-prompt" && (
        <Field
          label="The prompt"
          hint="Leave it empty and the sheet draws one, so a new sheet is a new prompt."
        >
          <TextArea
            value={config.prompt ?? ""}
            rows={3}
            maxLength={MAX_INSTRUCTIONS}
            placeholder="A door has appeared in your kitchen that was not there yesterday."
            onChange={(prompt) => set({ prompt })}
          />
        </Field>
      )}

      {config.style !== "writing-prompt" && !isListForm(config.style) && (
        <FieldSet
          legend="Room to write"
          hint="Taller lines, so fewer of them. The boxes always add up to one page."
        >
          <NumberStepper
            label="Room to write"
            value={config.space ?? FORM_SPACE.min}
            min={FORM_SPACE.min}
            max={FORM_SPACE.max}
            onChange={(space) => set({ space })}
          />
        </FieldSet>
      )}
    </>
  );
}
