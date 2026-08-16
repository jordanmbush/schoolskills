# How to count things

There is no analytics dashboard. There is no analytics service. What there is:
CloudFront writes an access log line for every request, those lines land in an
S3 bucket, and you run SQL over them when you want a number.

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

## Retention, which is a promise

Raw lines are deleted after **30 days** (`LOG_RETENTION_DAYS` in
`sst.config.ts`). `/privacy` tells parents that number, so it can go down
without ceremony and cannot go up without editing that page in the same PR.

The limit is on the raw lines, not on knowledge. A monthly count carries no IP
and no identifier, so **run the queries below monthly and keep the results
somewhere.** That's the intended workflow: the material expires, the
arithmetic doesn't.

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

**Unique visitors per day.** Approximate by design — see `/privacy`. A
household behind one router counts once; a phone changing network counts twice.
Only real page requests count, so assets and beacons don't inflate it:

```sql
SELECT "date", COUNT(DISTINCT request_ip) AS people
FROM cf_logs
WHERE status < 400
  AND uri NOT LIKE '/_astro/%'
  AND uri NOT LIKE '/_e/%'
  AND uri NOT LIKE '/fonts/%'
  AND sc_content_type LIKE 'text/html%'
GROUP BY "date"
ORDER BY "date" DESC;
```

**Which worlds get used:**

```sql
SELECT uri, COUNT(*) AS hits, COUNT(DISTINCT request_ip) AS people
FROM cf_logs
WHERE status < 400 AND sc_content_type LIKE 'text/html%'
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
- **Bots are in there.** Filter `user_agent` if a number looks implausible;
  the times-table pages exist to be crawled and are crawled accordingly.
- **Logs are delivered late** — usually minutes, occasionally hours. An empty
  result for today is normal, not a broken pipeline.
