/** 74210 → "1:14.21" · 9840 → "9.84" */
export function clock(ms: number, { withMinutes = true } = {}) {
  const safe = Math.max(0, ms);
  const totalSeconds = safe / 1000;
  if (withMinutes && totalSeconds >= 60) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds - mins * 60;
    return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
  }
  return totalSeconds.toFixed(2);
}

/** Signed split, rally style: "-1.42" when you're ahead. */
export function delta(ms: number) {
  const sign = ms > 0 ? "+" : ms < 0 ? "−" : "±";
  return `${sign}${(Math.abs(ms) / 1000).toFixed(2)}`;
}

/** Coarse duration for totals: "45s", "12m", "3h 20m". */
export function duration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
