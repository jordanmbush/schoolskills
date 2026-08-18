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

## Retention, and the thing that actually protects the history

Raw lines are deleted after **90 days** (`LOG_RETENTION_DAYS` in
`sst.config.ts`). `/privacy` tells parents that number, so it can go down
without ceremony and cannot go up without editing that page in the same PR.

**Retention is not what preserves the site's history.** A per-day count carries
no IP and no identifier, so the counts are what get kept — permanently, in this
repo, at `analytics/counts.json`. `.github/workflows/analytics.yml` runs on the
2nd of each month, reduces whatever is in the bucket to per-day totals, and
opens a PR with the result that merges itself once CI is green.

It opens a PR rather than pushing because `develop` requires the CI check and
a direct push from Actions carries none — the protected-branch hook declines
it. If a rollup PR is ever sitting open, CI failed on it; the numbers are
waiting, not lost.

If the bucket is empty the job now **fails** rather than quietly counting
nothing. CloudFront logs every request including crawlers, so zero files means
delivery has stopped, never that nobody visited — and a job that succeeds over
nothing cannot be monitored at all.

So the numbers you can look back on are bounded by _that job having run_, not by
the retention window. Retention only governs how far back a forgotten number can
be re-derived. If the job breaks it opens an issue, and that issue is more urgent
than it looks: while it is broken, history is on a 90-day timer.

Read the file directly on GitHub — no AWS login, no query, no dashboard:

```jsonc
"2026-08-16": {
  "visitors": 2,          // distinct IPs seen that day; approximate by design
  "pageViews": 3,
  "pages":  { "/": 1, "/flash-cards/": 1, "/spelling/play/": 1 },
  "events": { "race_start": 2, "race_end:finished": 1, "race_end:quit": 1 },
  "decks":  { "multiply": 1, "words:dolch-4": 1 }
}
```

Bots are excluded, assets and beacons don't count as page views, and re-running
overwrites per-day rather than accumulating — so a day whose logs arrived late is
corrected rather than doubled.

To run it by hand — after a fix, or just to see today before the 2nd:

```bash
npm run analytics                # sync, count, and print a summary
npm run analytics -- --days 7    # narrow the table
npm run analytics -- --no-sync   # re-summarise without re-downloading
```

That writes `analytics/counts.json`, the same file the job commits, so a local
run leaves a diff. `git checkout analytics/counts.json` if you only wanted to
look. The long way round still works and is what the workflow runs:

```bash
aws s3 sync s3://schoolskills-access-logs-<account>/cf/ /tmp/cflogs --profile schoolskills
node scripts/rollup-analytics.mjs /tmp/cflogs analytics/counts.json
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
is for one-off digging — a specific week, a referrer breakdown, a suspicion
about bot traffic.

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
- **Logs are delivered late** — usually minutes, occasionally hours. An empty
  result for today is normal, not a broken pipeline.
