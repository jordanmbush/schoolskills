/**
 * The line under the paper: which draw of the sheet this is, and the one thing
 * about printing a parent cannot guess — that the print dialog is also where
 * a file comes from (§10).
 */
export function Caption({ seed }: { seed: number }) {
  return (
    <p className="caption no-print">
      Sheet <span className="u-mono">{seed}</span>. The number is printed at the
      foot of the page, so this exact sheet can be had again. For a file rather
      than paper, choose <strong>Save as PDF</strong> in the print dialog.
    </p>
  );
}
