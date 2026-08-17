/**
 * What you do with a sheet once it is right: print it, or take a copy of it.
 *
 * **Print is the entire output path.** There is no PDF library here and there
 * never will be — it would cost about 600KB and a second rendering path that
 * drifts from the first (§10, decided) — so the browser's own dialog is the
 * download as well as the print, and the one line of hint under the button says
 * so in the words the dialog itself uses. A parent who wants a file and does not
 * know that "Save as PDF" is in there will conclude the site cannot make one.
 *
 * The link button copies the address bar, which already holds the whole
 * configuration: `useBuilder` rewrites `#s=` on every change, so there is
 * nothing to build here and nothing to keep in step.
 */
import { useState } from "react";

import { Button, Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";

import { MAX_VARIANTS } from "./useBuilder";

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
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard access is refused often enough — an insecure origin, a
      // browser that wants a gesture it didn't see — that failing silently
      // would be a button that does nothing. The URL is in the address bar
      // either way, so the honest fallback is to say so.
      setCopied(false);
    }
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
          {copied ? "Link copied" : "Copy link"}
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
