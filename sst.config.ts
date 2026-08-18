/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v4 — the whole infrastructure for schoolskills.app.
 *
 * It is deliberately small. The site is STATIC: `astro build` writes HTML to
 * `dist/`, SST uploads it to S3 and puts CloudFront in front. There is no VPC,
 * no NAT, no database, no Lambda holding a session — which is why this runs at
 * roughly $1–3/month instead of monilibrium's ~$40, and why there is no origin
 * that can be down.
 *
 * AWS account 578771850338 (its own member account in org o-2cxzjwimy7, so
 * billing separates cleanly in Cost Explorer), SSO profile `schoolskills`,
 * region us-west-1. Note that the CloudFront certificate is issued in
 * us-east-1 regardless — CloudFront only reads ACM certs from there — but SST
 * handles that cross-region provisioning itself.
 *
 * Stages:
 *   production  schoolskills.app + www redirect, DNS on Cloudflare.
 *   dev         CloudFront URL only, no custom domain. This is what makes the
 *               pipeline verifiable without holding the Cloudflare token.
 *   anything else → also domain-less, so a throwaway stage can never take over
 *               the live hostname by accident.
 *
 * DNS (mirrors the monilibrium pattern): the domain is Cloudflare-registered
 * and Cloudflare-authoritative. SST's Cloudflare adapter writes the app's CNAME
 * and the ACM validation records; there is no Route53 zone at all. Records are
 * written DNS-only (grey cloud) — CloudFront is already the CDN, and proxying
 * through Cloudflare on top would double up TLS termination for nothing.
 *
 * Env vars that gate production, read at deploy time and never committed:
 *   CLOUDFLARE_API_TOKEN   scoped to this zone only. Needs Zone:Read as well
 *                          as DNS:Edit — the "Edit zone DNS" template grants
 *                          both, and the account lookup below needs the read.
 *   CLOUDFLARE_ZONE_ID     not secret, but kept alongside for symmetry
 *   CLOUDFLARE_DEFAULT_ACCOUNT_ID
 *                          SST demands an account id even for a DNS-only
 *                          deploy, and a zone-scoped token can't list
 *                          accounts to find one. deploy.yml reads it off the
 *                          zone; set it by hand for a local `--stage
 *                          production` run.
 */

const DOMAIN = "schoolskills.app";

export default $config({
  app(input) {
    return {
      name: "schoolskills",
      // `retain` on production so a stray `sst remove` can't delete the bucket
      // holding the live site; dev is disposable.
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: input?.stage === "production",
      home: "aws",
      providers: {
        aws: {
          region: "us-west-1",
          // A named profile locally, nothing in CI.
          //
          // On a developer machine credentials come from `aws sso login
          // --profile schoolskills`. On a GitHub runner they arrive as
          // AWS_ACCESS_KEY_ID/SECRET/SESSION_TOKEN from the OIDC role
          // assumption, and there is no shared config file at all — naming a
          // profile there fails the deploy outright with "failed to get shared
          // config profile, schoolskills", after OIDC has already succeeded.
          profile: process.env.CI ? undefined : "schoolskills",
        },
        // Only production declares the Cloudflare provider. Declaring it
        // unconditionally makes Pulumi initialise and AUTHENTICATE it on every
        // stage, so a domain-less dev deploy fails with "Invalid access token"
        // despite never touching DNS. Pinned rather than floating: a provider
        // major can change record resource shapes and silently recreate DNS.
        ...(input?.stage === "production"
          ? { cloudflare: "6.16.0" as const }
          : {}),
      },
    };
  },

  async run() {
    const production = $app.stage === "production";

    /**
     * How long a raw access log line lives.
     *
     * /privacy states this number to parents, so it is a promise rather than a
     * preference — it may go down freely, and it may not go up without that
     * page changing in the same pull request.
     *
     * Ninety days, because a raw line contains an IP address and an IP
     * belonging to a child is the sort of thing worth not keeping. A quarter is
     * long enough to go back and re-derive a number nobody thought to take at
     * the time, which is the only thing retention actually buys.
     *
     * It is NOT what protects the history. The counts derived from these lines
     * carry no IP, so they are committed to the repo monthly by
     * .github/workflows/analytics.yml and kept forever. The raw material
     * expires; the arithmetic doesn't have to. If that job ever stops running,
     * this number quietly becomes the limit of what anyone can know about the
     * site's first year — so it is the job to fix, not this constant.
     */
    const LOG_RETENTION_DAYS = 90;

    // Only production claims the hostname. A dev or throwaway stage gets the
    // CloudFront URL, so it can deploy with no Cloudflare credentials at all.
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    if (production && !zoneId) {
      throw new Error(
        "CLOUDFLARE_ZONE_ID is required for the production stage — it's what points schoolskills.app at this distribution. Export it (and CLOUDFLARE_API_TOKEN, scoped to Zone:DNS:Edit) before deploying.",
      );
    }

    /**
     * Where CloudFront writes its access logs, and the only place any
     * measurement of this site comes from.
     *
     * There is no analytics script and no third-party anything — see
     * src/services/analytics.ts for the reasoning and docs/analytics.md for
     * how to read these. CloudFront already writes a line per request; this
     * bucket is just somewhere for it to go.
     *
     * Production only. A dev stage that logged would create a second bucket
     * with a second copy of everyone's IP address for no reason.
     */
    const logs = production
      ? new aws.s3.BucketV2("AccessLogs", {
          // Named deterministically rather than left to Pulumi's random
          // suffix, because two things have to find this bucket without
          // reading SST state: the monthly rollup workflow, and a human
          // following docs/analytics.md. The account id is what makes an S3
          // bucket name globally unique.
          bucket: aws
            .getCallerIdentityOutput({})
            .accountId.apply((id) => `schoolskills-access-logs-${id}`),
          forceDestroy: false,
        })
      : undefined;

    if (logs) {
      // CloudFront's standard logging writes with an ACL, so the bucket has to
      // accept one. Buckets created since April 2023 default to
      // BucketOwnerEnforced, which disables ACLs outright and makes the
      // distribution fail to deliver logs — silently, with no error anywhere
      // except the absence of files.
      new aws.s3.BucketOwnershipControls("AccessLogsOwnership", {
        bucket: logs.id,
        rule: { objectOwnership: "BucketOwnerPreferred" },
      });

      // Belt and braces: these logs contain IP addresses and must never be
      // readable by anyone but us. The bucket is private by default; saying so
      // explicitly means a later console click can't quietly undo it.
      new aws.s3.BucketPublicAccessBlock("AccessLogsPrivate", {
        bucket: logs.id,
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      });

      new aws.s3.BucketLifecycleConfigurationV2("AccessLogsExpiry", {
        bucket: logs.id,
        rules: [
          {
            id: "expire-raw-lines",
            status: "Enabled",
            // Scoped to the log prefix rather than the whole bucket, so that
            // anything else ever kept here isn't swept up by a rule that was
            // only ever about IP addresses.
            filter: { prefix: "cf/" },
            expiration: { days: LOG_RETENTION_DAYS },
            // A delivery that dies mid-upload otherwise accrues cost forever.
            abortIncompleteMultipartUpload: { daysAfterInitiation: 7 },
          },
        ],
      });
    }

    const site = new sst.aws.StaticSite("Site", {
      build: {
        command: "npm run build",
        output: "dist",
      },
      domain: production
        ? {
            name: DOMAIN,
            // The www alias exists to redirect, not to serve: two hostnames
            // serving identical HTML is a duplicate-content problem, and the
            // canonical tags in Base.astro all name the apex.
            redirects: [`www.${DOMAIN}`],
            dns: sst.cloudflare.dns({ zone: zoneId! }),
          }
        : undefined,
      /**
       * ⚠️ `fileOptions` REPLACES SST's default list, and SST only uploads
       * files that match some entry. The default starts with a `**` catch-all,
       * so omitting one doesn't just lose a cache header — those files are
       * never uploaded at all. An earlier version of this config listed only
       * the document and `_astro/` patterns, and the service worker, all four
       * icons and the Open Graph image were silently absent from the live site
       * while every page still served perfectly. Keep the catch-all first.
       *
       * Precedence is LAST-MATCH-WINS: SST reverses this array and skips files
       * it has already processed, so the most specific rule goes at the bottom.
       */
      assets: {
        fileOptions: [
          // Catch-all. Unhashed and therefore not immutable — icons and the OG
          // card do change, just rarely.
          {
            files: "**",
            cacheControl: "public,max-age=3600,s-maxage=86400,must-revalidate",
          },
          // Content-hashed by the build: the bytes at a given URL can never
          // change, so these are immutable forever.
          {
            files: "_astro/**",
            cacheControl: "public,max-age=31536000,immutable",
          },
          // Documents must revalidate or a deploy takes a day to become visible.
          {
            files: ["**/*.{html,xml,txt,json,webmanifest}"],
            cacheControl: "public,max-age=0,s-maxage=86400,must-revalidate",
          },
          // The service worker must never be served stale. A cached one keeps
          // controlling the page and shipping its own old cache rules, which is
          // the hardest kind of deploy to undo remotely.
          {
            files: "sw.js",
            cacheControl: "public,max-age=0,must-revalidate",
          },
          // The measurement pixel (src/services/analytics.ts). `no-store` so
          // neither the browser nor CloudFront can answer a beacon from cache:
          // a cached response means no request, and no request means no access
          // log line, which is the entire mechanism. The cache-buster in the
          // URL says the same thing twice on purpose — this one is cheap
          // insurance against a future edge cache policy that ignores it.
          {
            files: "_e/px.gif",
            cacheControl: "no-store",
          },
        ],
      },
      errorPage: "404.html",
      transform: {
        /**
         * Return a real 404 instead of a 502 on unknown paths.
         *
         * SST's StaticSite doesn't give the distribution a real origin: it
         * leaves `placeholder.sst.dev` configured and has its CloudFront
         * Function call `updateRequestOrigin()` to point at the S3 bucket
         * per request. That works for every normal request.
         *
         * It does NOT work for a CloudFront custom error response. When S3
         * answers 403/404, CloudFront fetches `responsePagePath` itself — and
         * that internal fetch does not run viewer-request functions, so no
         * origin is ever set and it goes to the placeholder host. The visitor
         * gets `502 Error from cloudfront` for what is simply a wrong URL,
         * which reads as a broken site and which Google treats as a server
         * fault rather than a missing page.
         *
         * Dropping `responsePagePath` makes CloudFront answer from its own
         * error handling: correct 404 status, no origin fetch, no 502. The
         * trade is CloudFront's plain error body instead of our branded 404
         * page — status right, styling lost. Serving the real page needs the
         * distribution to have a genuine S3 origin with its own OAC; that's
         * tracked as its own story rather than hand-rolled here.
         *
         * So: drop the custom error responses entirely and let S3's own status
         * pass straight through. CloudFront won't accept `responseCode`
         * without `responsePagePath` ("must specify both together"), so
         * rewriting the status without a page isn't an option either.
         *
         * On its own that would surface 403, not 404 — with only `s3:GetObject`
         * granted, S3 hides the difference between "missing" and "forbidden"
         * to avoid leaking which keys exist. The `assets` transform below adds
         * `s3:ListBucket`, which is exactly the permission that lets S3 answer
         * NoSuchKey. The bucket stays private; listing is granted to the
         * CloudFront service principal, not to the public.
         *
         * Result: a wrong URL gets a correct 404. The body is S3's plain XML
         * rather than our branded page — status right, styling lost. Serving
         * the real page needs the distribution to own a genuine S3 origin so
         * the error re-fetch has somewhere to go; that's its own story.
         *
         * `/404.html` is still built and still reachable directly.
         */
        cdn: (args) => {
          args.customErrorResponses = [];
          // Turn on access logging. This is the entire analytics pipeline:
          // no script, no cookie, no identifier, no third party — just the
          // request lines CloudFront was already generating, kept somewhere we
          // can count them. `includeCookies` stays false because we set none
          // and logging them would be a way to start.
          //
          // It has to go through `transform.distribution`, NOT straight onto
          // `args`. This callback receives the Cdn component's own `CdnArgs`,
          // which exposes a curated subset of the distribution — `domain`,
          // `origins`, `customErrorResponses` and friends — and `loggingConfig`
          // is not among them. An earlier version assigned it directly, which
          // Pulumi then dropped on the floor: no error, no warning, just a
          // distribution that never logged and a bucket that stayed empty from
          // the day analytics shipped. The monthly rollup compounded it by
          // "succeeding" over zero files, so the alarm built for exactly this
          // could never fire either.
          //
          // TypeScript does catch it — `Property 'loggingConfig' does not
          // exist on type 'CdnArgs'` — but nothing type-checks this file:
          // tsconfig.json excludes it (see the note there) and SST bundles it
          // with esbuild, which strips types without checking them. So the
          // compiler is not a backstop here; this comment is.
          //
          // The `assets` transform below nests the same way for the same
          // reason. If you add a distribution-level setting and it appears to
          // do nothing, this is why — check CdnArgs first.
          if (logs) {
            args.transform = {
              ...args.transform,
              distribution: (distributionArgs) => {
                distributionArgs.loggingConfig = {
                  bucket: logs.bucketDomainName,
                  prefix: "cf/",
                  includeCookies: false,
                };
              },
            };
          }
        },
        assets: (args) => {
          args.transform = {
            ...args.transform,
            policy: (policyArgs) => {
              policyArgs.policy = $resolve([
                policyArgs.policy,
                policyArgs.bucket,
              ]).apply(([policy, bucket]) => {
                const doc =
                  typeof policy === "string"
                    ? JSON.parse(policy)
                    : JSON.parse(JSON.stringify(policy));
                doc.Statement.push({
                  Effect: "Allow",
                  Principal: { Service: "cloudfront.amazonaws.com" },
                  Action: "s3:ListBucket",
                  Resource: `arn:aws:s3:::${bucket}`,
                });
                return JSON.stringify(doc);
              });
            },
          };
        },
      },
    });

    /**
     * A traffic pulse, for the questions that shouldn't need a log query.
     *
     * CloudFront publishes these metrics to CloudWatch for free and whether or
     * not anyone looks, so this dashboard costs nothing to feed — it is three
     * widgets over data AWS is already keeping. Retention is 15 months, which
     * is longer than the raw logs live (90 days) and shorter than
     * analytics/counts.json, which is forever.
     *
     * It deliberately does NOT try to be the analytics. `Requests` counts every
     * HTTP request — assets, fonts, beacons, bots, the deploy's own smoke
     * checks — so it is roughly an order of magnitude above page views and can
     * never be broken down by URL. What it is good for is the shape of things:
     * whether traffic moved, whether errors appeared, whether the site went
     * quiet. For "which pages, how many people", the rollup is the only answer.
     *
     * Production only, because the metrics are per-distribution and a dev stage
     * has nobody on it.
     *
     * ⚠️ CloudFront metrics live in **us-east-1** regardless of where anything
     * else is, and they carry a `Region: Global` dimension. Both are stated per
     * widget below; get either wrong and the graph renders empty rather than
     * failing, which is the worst way for a dashboard to be broken.
     */
    if (production) {
      const distributionId = site.nodes.cdn!.nodes.distribution.id;

      const widget = (
        x: number,
        y: number,
        title: string,
        metrics: unknown[],
      ) => ({
        type: "metric",
        x,
        y,
        width: 12,
        height: 6,
        properties: {
          title,
          view: "timeSeries",
          stacked: false,
          region: "us-east-1",
          period: 3600,
          metrics,
        },
      });

      new aws.cloudwatch.Dashboard("TrafficDashboard", {
        // Fixed name so a bookmark keeps working across deploys.
        dashboardName: "schoolskills-traffic",
        dashboardBody: distributionId.apply((id) =>
          JSON.stringify({
            widgets: [
              widget(0, 0, "Requests (all HTTP, not page views)", [
                [
                  "AWS/CloudFront",
                  "Requests",
                  "Region",
                  "Global",
                  "DistributionId",
                  id,
                  { stat: "Sum", label: "requests" },
                ],
              ]),
              widget(12, 0, "Error rate (%)", [
                [
                  "AWS/CloudFront",
                  "4xxErrorRate",
                  "Region",
                  "Global",
                  "DistributionId",
                  id,
                  { stat: "Average", label: "4xx" },
                ],
                [
                  "AWS/CloudFront",
                  "5xxErrorRate",
                  "Region",
                  "Global",
                  "DistributionId",
                  id,
                  { stat: "Average", label: "5xx" },
                ],
              ]),
              widget(0, 6, "Bytes downloaded", [
                [
                  "AWS/CloudFront",
                  "BytesDownloaded",
                  "Region",
                  "Global",
                  "DistributionId",
                  id,
                  { stat: "Sum", label: "bytes" },
                ],
              ]),
            ],
          }),
        ),
      });
    }

    return {
      url: site.url,
      stage: $app.stage,
      // Named in the outputs so docs/analytics.md doesn't have to hardcode a
      // generated bucket name that changes if the stack is ever rebuilt.
      logs: logs?.bucket ?? "none (production only)",
      dashboard: production
        ? "https://us-west-1.console.aws.amazon.com/cloudwatch/home#dashboards/dashboard/schoolskills-traffic"
        : "none (production only)",
    };
  },
});
