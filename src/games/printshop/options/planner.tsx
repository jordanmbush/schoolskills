/**
 * The week: which chart, and whose week it is.
 *
 * Every control here appears only where it means something, which on this
 * family is most of them — a calendar has a month and no row labels, a chore
 * chart has row labels and no month, and only one of the five has a verse on
 * it. A panel that showed all of them at once would be four fifths greyed out.
 *
 * The dates are the one switch worth a sentence. A calendar prints undated by
 * default because a blank month grid does not go out of date on a wall, and
 * "print the dates" is what turns it into September. Ticking it has to set both
 * the year and the month at once — `PlannerConfig.year` is explicit that it is
 * both or neither, because a year with no month is a config that arrived half
 * built rather than half a calendar.
 */
import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import { MONTH_NAMES, PLANNER_ROWS } from "@/engine/sheets/templates/planner";
import type { PlannerConfig, PlannerStyle } from "@/engine/sheets/types";

import { PassageControls } from "./passages";
import { Choice, TextLines, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<PlannerStyle>("calendar", "Calendar"),
  opt<PlannerStyle>("week", "Weekly planner"),
  opt<PlannerStyle>("chores", "Chore chart"),
  opt<PlannerStyle>("behaviour", "Behaviour chart"),
  opt<PlannerStyle>("verse-week", "Verse of the week"),
];

/**
 * Sunday or Monday, and it is a real difference rather than a preference: an
 * American calendar starts on Sunday and most of the rest of the world starts
 * on Monday, and a family handed the wrong one counts the weekend on the wrong
 * end of the row.
 */
const STARTS = [
  opt("sunday", "Sunday", "US"),
  opt("monday", "Monday", "UK and Europe"),
];

const MONTHS = MONTH_NAMES.map((name, index) => opt(String(index + 1), name));

/** The years worth stepping through by hand. Further out is a typed number. */
const YEARS = { min: 2020, max: 2040 };

/** What the row labels are called on each chart that has them. */
const LABELS: Record<string, { label: string; placeholder: string }> = {
  week: {
    label: "Columns",
    placeholder: "Morning\nAfternoon\nEvening",
  },
  chores: {
    label: "Jobs",
    placeholder: "Make my bed\nFeed the rabbit\nPut my washing away",
  },
  behaviour: {
    label: "What we are working on",
    placeholder: "Ask before I take\nFinish what I start",
  },
};

export function PlannerPanel({ config, set }: PanelProps<PlannerConfig>) {
  const dated =
    typeof config.year === "number" && typeof config.month === "number";
  const labels = LABELS[config.style];

  return (
    <>
      <Choice
        label="Which chart"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />

      {config.style !== "verse-week" && (
        <Choice
          label="The week starts on"
          value={config.weekStart ?? "sunday"}
          onChange={(weekStart) =>
            set({ weekStart: weekStart as PlannerConfig["weekStart"] })
          }
          options={STARTS}
        />
      )}

      {config.style === "calendar" && (
        <>
          <Checkbox
            label="Print the dates"
            hint="Leave it off and the squares are blank, which is a calendar that never goes out of date."
            checked={dated}
            // Both fields or neither. Today's month is the sensible thing to
            // land on and there is nowhere here to ask for it — the engine is
            // pure and has no clock — so it opens on January of the first year
            // the stepper offers and the parent moves it.
            onChange={(on) =>
              set(
                on
                  ? { year: config.year ?? YEARS.min, month: config.month ?? 1 }
                  : { year: undefined, month: undefined },
              )
            }
          />
          {dated && (
            <>
              <Choice
                label="Month"
                value={String(config.month ?? 1)}
                onChange={(month) => set({ month: Number(month) })}
                options={MONTHS}
              />
              <FieldSet legend="Year">
                <NumberStepper
                  label="Year"
                  value={config.year ?? YEARS.min}
                  min={YEARS.min}
                  max={YEARS.max}
                  onChange={(year) => set({ year })}
                />
              </FieldSet>
            </>
          )}
          {!dated && (
            <FieldSet
              legend="Rows"
              hint="Five is a month; six holds the longest one."
            >
              <NumberStepper
                label="Rows"
                value={config.rows ?? 5}
                min={4}
                max={6}
                onChange={(rows) => set({ rows })}
              />
            </FieldSet>
          )}
        </>
      )}

      {labels && (
        <TextLines
          label={labels.label}
          lines={config.labels ?? []}
          placeholder={labels.placeholder}
          onChange={(next) => set({ labels: next })}
        />
      )}

      {(config.style === "chores" || config.style === "behaviour") && (
        <FieldSet
          legend="Rows"
          hint="At least as many as you have written, and capped at what fits."
        >
          <NumberStepper
            label="Rows"
            value={config.rows ?? PLANNER_ROWS.fallback}
            min={1}
            max={PLANNER_ROWS.max}
            onChange={(rows) => set({ rows })}
          />
        </FieldSet>
      )}

      {config.style === "verse-week" && (
        <PassageControls
          passage={config.passage}
          translation={config.translation}
          text={config.text}
          onChange={set}
        />
      )}
    </>
  );
}
