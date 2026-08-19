# How to count things

There is no analytics service. Nothing is embedded in a page, no third party
sees a request, and no identifier follows anyone. What there is: CloudFront
writes an access log line for every request, those lines land in an S3 bucket,
and you count them when you want a number.

Three ways to look, in the order you'll want them:

| Want                         | Use                      |
| ---------------------------- | ------------------------ |
| Which pages, how many people | `npm run analytics`      |
| Did traffic move at all      | the CloudWatch dashboard |
| A one-off question           | Athena                   |

This is the whole of it, and it exists in this shape for a reason —
`/privacy` promises parents that nothing is stored on their child's device and
that no third party sees a request. Adding a hosted analytics tool would break
both. See the header of `src/services/analytics.ts`.

> ⚠️ **Nothing is kept beyond 90 days.** The access logs are the only record,
> and they expire. Ask a question about last quarter and there is no answer to
> find — see [The 90-day ceiling](#the-90-day-ceiling), which is an open
> problem rather than a design decision.

## What's being recorded

**Page requests.** Free, automatic, and already enough for most questions,
because the worlds are routes:

| Path                | Means                                                |
| ------------------- | ---------------------------------------------------- |
| `/`                 | the overworld map                                    |
| `/flash-cards/`     | The Grid — times tables                              |
| `/spelling/play/`   | Word Jungle — the spelling game                      |
| `/spelling/`        | the crawlable page about sight words                 |
| `/typing/`          | Frost Keys                                           |
| `/multiplication/…` | the twelve times-table pages (mostly search traffic) |

**In-game events**, as requests to `/_e/px.gif` with a query string. These
exist only for what a URL can't show. The complete list is the `Beacon` union
in `src/services/analytics.ts` — if it isn't there, it isn't collected:

| `e=`            | Other params      | Fired when                       |
| --------------- | ----------------- | -------------------------------- |
| `race_start`    | `deck`, `input`   | the 3·2·1 finishes               |
| `race_end`      | `deck`, `outcome` | a race is completed or quit      |
| `deck_saved`    | —                 | a parent saves a new custom deck |
| `profile_added` | —                 | a player is created              |

`deck` is a **shipped** deck id (`multiply`, `words:dolch-1`,
`typing:home-row`) or the literal `custom`. A household's own deck id is never
sent — see the tests in `src/services/analytics.test.ts`, which exist to keep
that true.

**Where a visit came from, and roughly where it was.** Both are read off the
same log line as everything else — no extra request, nothing added to a page:

| In the rollup | From the log field | Means                                      |
| ------------- | ------------------ | ------------------------------------------ |
| `referrers`   | `cs(Referer)`      | the site that linked here, host only       |
| `edges`       | `x-edge-location`  | the CloudFront PoP that served the request |

Two things to hold onto, because both are easy to over-read:

- **`referrers` is a bare hostname and nothing more.** Never a path, never a
  query string. A full referrer URL routinely carries what someone searched
  for, and occasionally a token from a link that was pasted somewhere, so
  `google.com` is all that is ever carried out of a log line — no matter where
  the output is later put. `(none)` is a request that sent no referrer at all — direct,
  but also every https→http hop, privacy-preserving browser, native app and
  link out of a document. Read it as a floor on direct traffic, not a measure
  of it. Our own pages are not counted, since internal navigation would bury
  the inbound links that are the point.
- **`edges` is where the request was served, not where the visitor is.**
  CloudFront routes to a nearby PoP, so `SEA` means "closer to Seattle than to
  anywhere else with a PoP" — Vancouver is served from Seattle, and anyone on
  a VPN is served from wherever the exit node is. It answers "roughly which
  part of the world", never "which country". The field that answers that
  properly is `c-country`, which the legacy standard log format does not have;
  getting it means moving the distribution to standard logging v2, a different
  delivery mechanism rather than a field to add to the rollup.

## The 90-day ceiling

Raw lines are deleted after **90 days** (`LOG_RETENTION_DAYS` in
`sst.config.ts`). `/privacy` tells parents that number, so it can go down
without ceremony and cannot go up without editing that page in the same PR.

**That is the whole of the site's memory, and it is a known gap.** There used
to be a monthly job that reduced the bucket to per-day totals and committed
them to this repo at `analytics/counts.json`, permanently. It was removed, on
the grounds that a repo is where _code_ lives forever — generated analytics
are not code. The file grew without bound in a source tree, it duplicated a
system of record that already existed in S3, and GitHub parks bot-authored PRs
at `action_required`, so landing it was a manual click every single month.

What replaced it: nothing, yet. So today —

| Record               | Lives     | Granularity                  |
| -------------------- | --------- | ---------------------------- |
| S3 access logs       | 90 days   | every request, full detail   |
| CloudWatch dashboard | 15 months | request counts only, no URLs |

The dashboard is now the longest-lived thing there is, and it cannot be broken
down by page, referrer or anything else. **A day that ages past 90 days is
gone and cannot be recounted.** Somewhere durable for the aggregates is owed
before that starts to matter; the shape of it is an open question, and the
constraint is that it must not be this repo and must not be a third party that
sees a child's request.

## Looking at what's there

```bash
npm run analytics                # sync, count, and print a summary
npm run analytics -- --days 7    # narrow the table
npm run analytics -- --no-sync   # re-summarise without re-downloading
```

It writes its counts to a temp file and prints the path. Nothing is kept and
nothing lands in the repo — if you want a number preserved, copy it out
yourself. Bots are excluded, assets and beacons don't count as page views, and
a re-run overwrites per-day rather than accumulating, so a day whose logs
arrived late is corrected rather than doubled.

One day looks like this:

```jsonc
"2026-08-16": {
  "visitors": 2,          // distinct IPs seen that day; approximate by design
  "pageViews": 3,
  "pages":     { "/": 1, "/flash-cards/": 1, "/spelling/play/": 1 },
  "referrers": { "(none)": 2, "t.co": 1 },   // host only, never a path
  "edges":     { "SEA": 2, "LHR": 1 },       // the edge, not the visitor
  "events":    { "race_start": 2, "race_end:finished": 1, "race_end:quit": 1 },
  "decks":     { "multiply": 1, "words:dolch-4": 1 }
}
```

The long way round, if you want the pieces separately:

```bash
aws s3 sync s3://schoolskills-access-logs-<account>/cf/ /tmp/cflogs --profile schoolskills
node scripts/rollup-analytics.mjs /tmp/cflogs /tmp/counts.json
```

## The dashboard, for "is anything happening"

`schoolskills-traffic` in CloudWatch (us-west-1 console, metrics from
us-east-1) — requests, error rate and bytes, defined in `sst.config.ts` and
deployed with everything else.

It is a pulse, not analytics. `Requests` counts every HTTP request — assets,
fonts, beacons, bots, the deploy's own smoke checks — so it runs roughly an
order of magnitude above page views and can never be split by URL. Use it to
see whether traffic moved or errors appeared; use the rollup for who and what.

Its one real advantage: CloudWatch keeps these metrics for 15 months and does
it whether or not logging is configured, so it is also the only record of any
period when the log pipeline was broken.

## Athena, for questions the rollup doesn't answer

Everything below is optional. The rollup covers the standing questions; Athena
is for one-off digging — a specific week, a suspicion about bot traffic, or the
part of a referrer the rollup deliberately throws away. It is the only place a
full referring URL can be seen, and only for as long as the raw lines live.

## Setting up Athena (once)

Find the bucket:

```bash
npx sst shell --stage production -- printenv | grep -i logs
# or: aws s3 ls --profile schoolskills | grep accesslogs
```

Create the table. CloudFront's standard log format is fixed, so this DDL is
copy-paste — replace only the `LOCATION`:

```sql
CREATE EXTERNAL TABLE IF NOT EXISTS cf_logs (
  `date`                   DATE,
  `time`                   STRING,
  `location`               STRING,
  `bytes`                  BIGINT,
  `request_ip`             STRING,
  `method`                 STRING,
  `host`                   STRING,
  `uri`                    STRING,
  `status`                 INT,
  `referrer`               STRING,
  `user_agent`             STRING,
  `query_string`           STRING,
  `cookie`                 STRING,
  `result_type`            STRING,
  `request_id`             STRING,
  `host_header`            STRING,
  `request_protocol`       STRING,
  `request_bytes`          BIGINT,
  `time_taken`             FLOAT,
  `xforwarded_for`         STRING,
  `ssl_protocol`           STRING,
  `ssl_cipher`             STRING,
  `response_result_type`   STRING,
  `http_version`           STRING,
  `fle_status`             STRING,
  `fle_encrypted_fields`   INT,
  `c_port`                 INT,
  `time_to_first_byte`     FLOAT,
  `x_edge_detailed_result_type` STRING,
  `sc_content_type`        STRING,
  `sc_content_len`         BIGINT,
  `sc_range_start`         BIGINT,
  `sc_range_end`           BIGINT
)
ROW FORMAT DELIMITED FIELDS TERMINATED BY '\t'
LOCATION 's3://REPLACE-WITH-BUCKET/cf/'
TBLPROPERTIES ('skip.header.line.count'='2');
```

## The queries

**What counts as a page view.** Both queries below start from the same CTE,
because getting this predicate wrong is how the pipeline's first day of data
managed to record two bots as visitors and miss the only human. It mirrors
`isPageView()` in `scripts/rollup-analytics.mjs` — **if you change one, change
the other**, and the reasoning for each clause is commented there.

```sql
WITH pages AS (
  SELECT *
  FROM cf_logs
  WHERE (
          -- Served: the content-type settles it.
          (status = 200 AND sc_content_type LIKE 'text/html%')
          -- Revalidated: HTML is `must-revalidate`, so a returning visitor
          -- gets a 304 — which carries no content-type at all. The path is
          -- the only thing left to judge it by: a filename with an extension
          -- is an asset, anything else is a document.
       OR (status = 304
           AND (NOT regexp_like(uri, '\.[^/.]+$') OR regexp_like(uri, '\.html?$')))
        )
    -- NOT `status < 400`: the http→https redirect is text/html with status
    -- 301, so that counted every http arrival twice and promoted scanners
    -- that only ever got a redirect into visitors.
    AND NOT regexp_like(lower(user_agent), 'bot|crawler|spider|slurp|curl|wget')
)
```

**Unique visitors per day.** Approximate by design — see `/privacy`. A
household behind one router counts once; a phone changing network counts twice.

```sql
SELECT "date", COUNT(DISTINCT request_ip) AS people
FROM pages
GROUP BY "date"
ORDER BY "date" DESC;
```

**Which worlds get used:**

```sql
SELECT uri, COUNT(*) AS hits, COUNT(DISTINCT request_ip) AS people
FROM pages
GROUP BY uri
ORDER BY hits DESC;
```

**Races started and finished, by deck.** The number worth watching: a deck with
lots of starts and few finishes is too long, too hard, or broken.

```sql
WITH e AS (
  SELECT
    url_extract_parameter('?' || query_string, 'e')      AS event,
    url_extract_parameter('?' || query_string, 'deck')   AS deck,
    url_extract_parameter('?' || query_string, 'outcome') AS outcome
  FROM cf_logs
  WHERE uri = '/_e/px.gif'
)
SELECT
  deck,
  COUNT_IF(event = 'race_start')                            AS started,
  COUNT_IF(event = 'race_end' AND outcome = 'finished')     AS finished,
  COUNT_IF(event = 'race_end' AND outcome = 'quit')         AS quit
FROM e
GROUP BY deck
ORDER BY started DESC;
```

**Which links actually send people.** The rollup keeps only the host; this is
where the rest of the URL still exists, so it is how you tell one post from
another on the same site. Only works within the 90-day window.

```sql
SELECT referrer, COUNT(*) AS views, COUNT(DISTINCT request_ip) AS people
FROM pages
WHERE referrer <> '-'
  AND url_extract_host(referrer) NOT LIKE '%schoolskills.app'
GROUP BY referrer
ORDER BY views DESC;
```

**Roughly where from**, by edge location — the PoP code is the first letters of
`location`, and see the caveat above before reading it as geography:

```sql
SELECT regexp_extract(location, '^[A-Z]+') AS pop,
       COUNT(*) AS views, COUNT(DISTINCT request_ip) AS people
FROM pages
GROUP BY 1
ORDER BY views DESC;
```

**How answers are entered** (does anyone use "spot it"?):

```sql
SELECT url_extract_parameter('?' || query_string, 'input') AS input,
       COUNT(*) AS races
FROM cf_logs
WHERE uri = '/_e/px.gif'
  AND url_extract_parameter('?' || query_string, 'e') = 'race_start'
GROUP BY 1;
```

**Is the custom-deck feature used at all:**

```sql
SELECT "date",
       COUNT_IF(url_extract_parameter('?' || query_string, 'e') = 'deck_saved')
         AS decks_saved,
       COUNT_IF(url_extract_parameter('?' || query_string, 'e') = 'profile_added')
         AS profiles_added
FROM cf_logs
WHERE uri = '/_e/px.gif'
GROUP BY "date"
ORDER BY "date" DESC;
```

## Things that will trip you up

- **Beacons are lost offline.** The service worker deliberately ignores `/_e/`
  (see `public/sw.js`), so a race played on a plane is never counted. Installed
  offline play is a real use case here, so treat event counts as a floor.
- **Page requests are a floor too**, for the opposite reason: a returning
  visitor whose HTML is still in the service worker's cache never reaches
  CloudFront.
- **A returning visitor who does reach CloudFront arrives as a 304.** HTML is
  `must-revalidate`, so the second visit revalidates rather than re-downloads,
  and a 304 carries no content-type. Any query that identifies pages by
  content-type alone therefore counts first visits only. The `pages` CTE above
  handles it; a query written from scratch will not.
- **An undeclared bot is a visitor.** Filtering is on the user-agent, so
  anything that says it is a crawler is excluded and anything that lies is
  counted as a person. On this pipeline's first day, a datacentre IP wearing a
  desktop Chrome user-agent was one of the two recorded "visitors". Treat small
  visitor counts as an upper bound.
- **Bots are in there.** Filter `user_agent` if a number looks implausible;
  the times-table pages exist to be crawled and are crawled accordingly.
- **One site can arrive under several hosts.** The first real week showed
  `facebook.com` and `l.facebook.com` counted separately — the second is
  Facebook's link shim, and `m.`/`lm.` variants exist too. Only `www.` is
  folded, because folding subdomains in general is wrong (`sites.google.com`
  is not `google.com`). Add them up by eye rather than teaching the rollup a
  list of shim hostnames it would have to keep current.
- **An edge code is not a country.** `edges` says which CloudFront PoP served
  the request. It is near the visitor, not at them, and a VPN moves it
  entirely.
- **`referrers` does not sum to `pageViews`, but `edges` does.** Our own pages
  are dropped from the first and nothing is dropped from the second, so the
  gap between them is roughly the internal navigation — 11 views against 4
  referrers on 2026-08-18 was one visitor clicking around the site.
- **Logs are delivered late** — usually minutes, occasionally hours. An empty
  result for today is normal, not a broken pipeline.
