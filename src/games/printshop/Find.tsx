import { useEffect, useState } from "react";

import { Button, Input } from "@/components/ui/kit";
import {
  EMPTY_QUERY,
  findSheets,
  isIdle,
  readQuery,
  writeQuery,
  type Facet,
  type Query,
  type SheetIndex,
} from "@/engine/sheets/search";

/**
 * The search box on the front door of the Print Shop — the Shop's second island,
 * and much the smaller of the two: the bench builds a sheet, this one only finds
 * one.
 *
 * A `client:only` island over a file the build wrote, with the query in the
 * fragment rather than a query string (§8). The whole job happens in the
 * browser: no query goes anywhere, because there is nowhere for one to go.
 */
const INDEX_URL = "/printables/search-index.json";

/**
 * The index, fetched on mount rather than on first keystroke. The facets are
 * half of what the search is for, and a row of chips that only appears once you
 * have guessed there is something to type into is not a facet, it is a secret.
 *
 * A failure is shown rather than swallowed. The shelves below are the answer
 * either way, and a search box that quietly stays empty would read as a shop
 * with nothing in it.
 */
function useIndex(): { index: SheetIndex | null; failed: boolean } {
  const [index, setIndex] = useState<SheetIndex | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(INDEX_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`${INDEX_URL} → ${response.status}`);
        return response.json() as Promise<SheetIndex>;
      })
      .then((loaded) => {
        if (live) setIndex(loaded);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return { index, failed };
}

/**
 * Which of the three things the island can be doing.
 *
 * The box is typeable from the first paint and the index arrives after it, so
 * "nothing matched" and "nothing has arrived yet" would otherwise render as the
 * same sentence. A parent on the slow phone this search exists for can out-type
 * the fetch, and "0 sheets" over a shop that has their sheet reads as a shop
 * that has nothing.
 */
type Status = "loading" | "failed" | "ready";

/**
 * The line in the live region.
 *
 * A count is a claim about the catalog, so it is only made once the catalog is
 * here. Before that the region says what is true — it is still loading — and
 * after a failure it says nothing at all, because the note below has already
 * said so and a polite region would otherwise repeat it once per keystroke.
 *
 * Exported for the suite: testing the sentence is cheaper and stricter than
 * driving a `client:only` island.
 */
export function countNote(
  status: Status,
  narrowed: boolean,
  hits: number,
): string {
  if (!narrowed || status === "failed") return "";
  if (status === "loading") return "Still loading the catalog…";
  return hits === 1 ? "1 sheet" : `${hits} sheets`;
}

/**
 * One facet, as a row of chips.
 *
 * Pressing the chosen one again clears it, which is what a row with no "any"
 * chip has to mean — and `aria-pressed` says so out loud rather than leaving the
 * state to the colour.
 */
function Chips({
  legend,
  facet,
  value,
  onPick,
}: {
  legend: string;
  facet: Facet;
  value: string;
  onPick: (id: string) => void;
}) {
  if (facet.length === 0) return null;

  return (
    <div className="find__facet" role="group" aria-label={legend}>
      <p className="find__legend">{legend}</p>
      <div className="stones">
        {facet.map(([id, label]) => (
          <Button
            key={id}
            variant="bare"
            className="stone"
            pressed={value === id}
            onClick={() => onPick(value === id ? "" : id)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function Find() {
  /*
    Captured at first render, before the effect below starts rewriting it. A
    shared search arrives as a fragment, and the URL is also where this component
    writes its own state, so the incoming one has to be read out of the way first
    or the island would erase the link it was opened with.
  */
  const [entry] = useState(() => window.location.hash);
  const [query, setQuery] = useState<Query>(EMPTY_QUERY);
  const { index, failed } = useIndex();

  useEffect(() => {
    if (!index) return;
    // Only if nothing has been typed in the meantime: the file may land after
    // a fast reader has already started narrowing, and their words win.
    setQuery((current) =>
      isIdle(current) ? readQuery(entry, index) : current,
    );
  }, [entry, index]);

  useEffect(() => {
    if (!index) return;
    const { pathname, search } = window.location;
    // `replaceState`, not `pushState`: a search is refined a keystroke at a
    // time, and a back button that walks back through eleven of them is a
    // trap rather than a history.
    window.history.replaceState(
      null,
      "",
      `${pathname}${search}${writeQuery(query)}`,
    );
  }, [index, query]);

  const status: Status = failed ? "failed" : index ? "ready" : "loading";
  const narrowed = !isIdle(query);
  const hits = index && narrowed ? findSheets(index, query) : [];
  const set = (part: Partial<Query>) => setQuery({ ...query, ...part });

  return (
    <section className="band band--tight wrap no-print find">
      <h2 className="h2">Find a sheet</h2>
      <p className="h2__sub">
        {index ? `${index.sheets.length} sheets` : "Every sheet in the shop"} in
        one box. Type what you are after &mdash; &ldquo;graph paper&rdquo;,
        &ldquo;long division&rdquo;, &ldquo;third grade spelling&rdquo; &mdash;
        or narrow it with the rows underneath. Nothing you type leaves this
        page, because there is nowhere for it to go.
      </p>

      <Input
        className="find__field"
        type="search"
        value={query.text}
        onChange={(text) => set({ text })}
        placeholder="Search the printables"
        aria-label="Search the printables"
        autoComplete="off"
      />

      {index && (
        <>
          <Chips
            legend="School year"
            facet={index.facets.grade}
            value={query.grade}
            onPick={(grade) => set({ grade })}
          />
          <Chips
            legend="Subject"
            facet={index.facets.subject}
            value={query.subject}
            onPick={(subject) => set({ subject })}
          />
          <Chips
            legend="Kind of sheet"
            facet={index.facets.type}
            value={query.type}
            onPick={(type) => set({ type })}
          />
          <Chips
            legend="Ruling"
            facet={index.facets.rule}
            value={query.rule}
            onPick={(rule) => set({ rule })}
          />
        </>
      )}

      {failed && (
        <p className="find__note">
          The catalog didn&rsquo;t load, so there is nothing here to search.
          Everything in the shop is set out below, shelf by shelf, and by school
          year on <a href="/printables/grade">the year pages</a>.
        </p>
      )}

      {/* Polite rather than assertive: the count changes on every keystroke,
          and an assertive region would interrupt the word being typed. */}
      <p className="find__count" aria-live="polite">
        {countNote(status, narrowed, hits.length)}
      </p>

      {narrowed && hits.length > 0 && (
        <div className="prose find__hits">
          <ul>
            {hits.map((hit) => (
              <li key={hit.href}>
                <a href={hit.href}>{hit.name}</a> &mdash; {hit.teaches}.{" "}
                <span className="find__ages">{hit.ages}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Only once the catalog is here to be searched: an empty result before
          then is a sentence about a shop nobody has looked in yet, and on the
          failure path it would sit under the note above and contradict it. */}
      {status === "ready" && narrowed && hits.length === 0 && (
        <p className="find__note">
          Nothing in the shop matches that. Try fewer words, or clear the rows
          &mdash; the whole catalog is set out below either way.
        </p>
      )}

      {narrowed && (
        <div className="hero__actions">
          <Button
            variant="bare"
            className="cta cta--quiet"
            onClick={() => setQuery(EMPTY_QUERY)}
          >
            Clear the search
          </Button>
        </div>
      )}
    </section>
  );
}
