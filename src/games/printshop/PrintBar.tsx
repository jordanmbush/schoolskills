/**
 * What you do with a sheet once it is right: print it, or take a copy of it.
 *
 * Print is the entire output path and the browser's own dialog is the download
 * as well as the print (§10), which is what the hint under the button is for: a
 * parent who does not know "Save as PDF" is in there will conclude the site
 * cannot make a file at all.
 *
 * The link button copies the address bar, which already holds the whole
 * configuration: `useBuilder` rewrites `#s=` on every change, so there is
 * nothing to build here and nothing to keep in step.
 */
import { useState } from "react";

import { Button, Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";

import { MAX_VARIANTS } from "./useBuilder";

/**
 * The button's three labels. "Copy it from the address bar" is the refusal, and
 * it is an instruction rather than an apology: the link the button would have
 * copied is already visible, so the one useful thing to say is where.
 */
const COPY_LABEL = {
  nothing: "Copy link",
  copied: "Link copied",
  refused: "Copy it from the address bar",
} as const;

export function PrintBar({
  seed,
  variants,
  answers,
  onVariants,
  onAnswers,
  onReroll,
}: {
  seed: number;
  variants: number;
  answers: boolean;
  onVariants: (count: number) => void;
  onAnswers: (on: boolean) => void;
  onReroll: () => void;
}) {
  // Three states rather than a boolean, because the failure has to be visible:
  // see `copyLink`.
  const [said, setSaid] = useState<"nothing" | "copied" | "refused">("nothing");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setSaid("copied");
    } catch {
      // Clipboard access is refused often enough — an insecure origin, a
      // browser that wants a gesture it didn't see — that failing silently
      // would be a button that does nothing. The URL is in the address bar
      // either way, so the honest fallback is to say so.
      setSaid("refused");
    }
    window.setTimeout(() => setSaid("nothing"), 2400);
  };

  return (
    <div className="printbar no-print">
      <div className="printbar__row">
        <FieldSet
          legend="Copies"
          hint="Each one is a different draw of the same settings."
        >
          <NumberStepper
            label="Copies"
            value={variants}
            min={1}
            max={MAX_VARIANTS}
            onChange={onVariants}
          />
        </FieldSet>
        <Checkbox
          label="Answer key"
          hint="Printed after each copy, on its own page."
          checked={answers}
          onChange={onAnswers}
        />
      </div>

      <div className="printbar__actions">
        <Button variant="go" onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="ghost" onClick={onReroll}>
          Another sheet like this
        </Button>
        <Button variant="ghost" onClick={() => void copyLink()}>
          {COPY_LABEL[said]}
        </Button>
      </div>

      <p className="printbar__hint">
        Choose <strong>Save as PDF</strong> in the print dialog if you want a
        file rather than paper &mdash; that is the download, and it is the
        browser&rsquo;s own.
      </p>
      <p className="printbar__seed">
        Sheet <span className="u-mono">{seed}</span>. The number is printed at
        the foot of the page, so this exact sheet can be had again.
      </p>
    </div>
  );
}
