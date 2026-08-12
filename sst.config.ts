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
 * Two env vars gate production and are read at deploy time, never committed:
 *   CLOUDFLARE_API_TOKEN   scoped to Zone:DNS:Edit on this zone only
 *   CLOUDFLARE_ZONE_ID     not secret, but kept alongside for symmetry
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

    // Only production claims the hostname. A dev or throwaway stage gets the
    // CloudFront URL, so it can deploy with no Cloudflare credentials at all.
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    if (production && !zoneId) {
      throw new Error(
        "CLOUDFLARE_ZONE_ID is required for the production stage — it's what points schoolskills.app at this distribution. Export it (and CLOUDFLARE_API_TOKEN, scoped to Zone:DNS:Edit) before deploying.",
      );
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

    return {
      url: site.url,
      stage: $app.stage,
    };
  },
});
