/**
 * Penmanship: what to work on, and the same ruling, model and repeats as
 * handwriting — because it is the same row, and a parent moving between the
 * two panels should find the paper question asked the same way (§24).
 *
 * Only one content control is on screen at a time, for the reason the
 * handwriting panel gives: a list of sentences under a sheet of loops is a box
 * that does nothing. Two styles hide the model and the progression as well — a
 * check sheet is always a model and then the child's own tries, and a timed
 * sheet is a model and then empty lines, so a control that offered dotted
 * letters there would be one the sheet quietly ignored.
 *
 * The families offered are the ones the hand chosen under Face actually has:
 * print has no loop letters and a joined hand has no straight slants, and a
 * family the page cannot draw is not a choice.
 */
import { isCursive } from "@/engine/sheets/faces";
import type {
  FluencyTask,
  LetterCase,
  LetterFamily,
  PenmanshipConfig,
  PenmanshipStyle,
  StrokePattern,
  TraceStyle,
} from "@/engine/sheets/types";
import { familiesOf } from "@/engine/sheets/writing/letterfamilies";
import { MAX_LINES, MAX_MINUTES } from "@/engine/sheets/writing/penmanship";
import { MAX_REPEATS } from "@/engine/sheets/writing/rows";
import {
  STROKE_PATTERNS,
  strokePattern,
} from "@/engine/sheets/writing/strokes";

import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import { parseWords } from "@/services/decks";

import { GuidesControl } from "./guides";
import {
  Choice,
  Pool,
  TextLines,
  WordList,
  opt,
  type PanelProps,
} from "./parts";
import { RULED_STYLES, RulingControls } from "./ruling";

const STYLES = [
  opt<PenmanshipStyle>("strokes", "Strokes", "the shapes letters are made of"),
  opt<PenmanshipStyle>("families", "Families", "letters that start alike"),
  opt<PenmanshipStyle>("sizes", "Sizes", "tall, small and tail"),
  opt<PenmanshipStyle>("spacing", "Spacing", "a finger space between words"),
  opt<PenmanshipStyle>("check", "Check", "write it, then circle the best"),
  opt<PenmanshipStyle>("fluency", "Speed", "as many as you can, neatly"),
];

/** Every family, or one of them — and "every" first, as the joins panel has it. */
const ALL_FAMILIES = "";

const CASES = [
  opt<LetterCase>("lower", "a", "small letters"),
  opt<LetterCase>("upper", "A", "capitals"),
];

const CHECK_CASES = [...CASES, opt<LetterCase>("both", "Aa", "the pair")];

const TASKS = [
  opt<FluencyTask>("alphabet", "The alphabet", "a to z, from memory"),
  opt<FluencyTask>("sentence", "A sentence", "copied over and over"),
];

/** The five appearances of §6, plus the sheet with nothing to trace at all. */
const TRACES = [
  opt<TraceStyle>("dotted", "Dotted", "the usual"),
  opt<TraceStyle>("dashed", "Dashed"),
  opt<TraceStyle>("hollow", "Hollow", "a thin line, on a stroke"),
  opt<TraceStyle>("dim", "Grey"),
  opt<TraceStyle>("solid", "Solid"),
  opt<TraceStyle>("none", "None", "a model, then empty lines"),
];

const PATTERN_IDS = STROKE_PATTERNS.map((set) => set.id);

export function PenmanshipPanel({ config, set }: PanelProps<PenmanshipConfig>) {
  const style = config.style;
  const traced = style !== "check" && style !== "fluency";
  const hand = isCursive(config.font) ? "cursive" : "print";
  const families = [
    opt<LetterFamily | typeof ALL_FAMILIES>(ALL_FAMILIES, "All", "in order"),
    ...familiesOf(hand, config.letters === "upper" ? "upper" : "lower").map(
      (family) =>
        opt<LetterFamily | typeof ALL_FAMILIES>(
          family.id,
          family.label,
          family.blurb,
        ),
    ),
  ];

  return (
    <>
      <Choice
        label="What to work on"
        value={style}
        onChange={(next) => set({ style: next })}
        options={STYLES}
      />

      {style === "strokes" && (
        <>
          <Pool
            label="Patterns"
            values={PATTERN_IDS}
            chosen={config.patterns ?? PATTERN_IDS}
            onChange={(patterns) => set({ patterns })}
            labelOf={(id: StrokePattern) => strokePattern(id).label}
            hint="In the order they are taught. Tail loops need room for descenders under the lines, and drop out without it."
          />
          <FieldSet
            legend="Lines per pattern"
            hint="The first line is the model and the tracing; any more are the child's own."
          >
            <NumberStepper
              label="Lines per pattern"
              value={config.lines ?? 1}
              min={1}
              max={MAX_LINES}
              onChange={(lines) => set({ lines })}
            />
          </FieldSet>
        </>
      )}

      {style === "families" && (
        <>
          <Choice
            label="Which letters"
            value={config.letters === "upper" ? "upper" : "lower"}
            onChange={(letters) => set({ letters })}
            options={CASES}
          />
          <Choice
            label="Which family"
            value={config.family ?? ALL_FAMILIES}
            onChange={(family) => set({ family: family || undefined })}
            options={families}
            hint="Which letters share a stroke is the hand's answer, so the list follows the face chosen above."
          />
        </>
      )}

      {style === "check" && (
        <>
          <Choice
            label="Which letters"
            value={config.letters ?? "lower"}
            onChange={(letters) => set({ letters })}
            options={CHECK_CASES}
          />
          <WordList
            label="Or your own words"
            text={(config.words ?? []).join("\n")}
            onChange={(text) => set({ words: parseWords(text) })}
            hint="One a line. Leave it empty for the alphabet above."
            rows={3}
          />
        </>
      )}

      {style === "spacing" && (
        <TextLines
          label="Sentences"
          lines={(config.text ?? "").split("\n")}
          onChange={(lines) => set({ text: lines.join("\n") })}
          hint="One a line, each on its own row of the sheet. Leave it empty for five short ones."
          placeholder="The dog ran to me."
        />
      )}

      {style === "fluency" && (
        <>
          <Choice
            label="What to write"
            value={config.task ?? "alphabet"}
            onChange={(task) => set({ task })}
            options={TASKS}
          />
          {config.task === "sentence" && (
            <TextLines
              label="The sentence"
              lines={(config.text ?? "").split("\n")}
              onChange={(lines) => set({ text: lines.join("\n") })}
              hint="The first line is the one copied. Leave it empty for a sentence with every letter in it."
              placeholder="The quick brown fox jumps over the lazy dog."
              rows={2}
            />
          )}
          <FieldSet
            legend="Minutes on the timer"
            hint="One for the alphabet, two for a sentence, unless you say otherwise."
          >
            <NumberStepper
              label="Minutes on the timer"
              value={config.minutes ?? (config.task === "sentence" ? 2 : 1)}
              min={1}
              max={MAX_MINUTES}
              onChange={(minutes) => set({ minutes })}
            />
          </FieldSet>
        </>
      )}

      <RulingControls
        rule={config.rule}
        onChange={(patch) => set({ rule: { ...config.rule, ...patch } })}
        options={RULED_STYLES}
      />

      {traced && (
        <Choice
          label="How the model is drawn"
          value={config.trace}
          onChange={(trace) => set({ trace })}
          options={TRACES}
        />
      )}

      {style !== "strokes" && (
        <GuidesControl
          font={config.font}
          value={config.guides}
          onChange={(guides) => set({ guides })}
        />
      )}

      {style !== "fluency" && (
        <FieldSet
          legend={
            style === "check" ? "Model and tries" : "Times each is written"
          }
          hint={
            style === "check"
              ? "The model, then this many tries after it to choose the best from."
              : "Capped at what the line holds."
          }
        >
          <NumberStepper
            label={
              style === "check" ? "Model and tries" : "Times each is written"
            }
            value={config.repeats}
            min={style === "check" ? 2 : 1}
            max={MAX_REPEATS}
            onChange={(repeats) => set({ repeats })}
          />
        </FieldSet>
      )}

      {traced && (
        <Checkbox
          label="Trace, then write it alone"
          hint="A solid model first and an empty place last, with the tracing in between."
          checked={config.progression !== false}
          onChange={(progression) => set({ progression })}
        />
      )}
    </>
  );
}
