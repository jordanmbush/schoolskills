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
        aws: { region: "us-west-1", profile: "schoolskills" },
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
      // Astro emits content-hashed filenames under _astro/, so those are
      // immutable forever. Everything else — HTML, the sitemap, robots.txt —
      // must revalidate, or a deploy would take a day to become visible.
      assets: {
        fileOptions: [
          {
            files: ["**/*.{html,xml,txt,json,webmanifest}"],
            cacheControl: "public,max-age=0,s-maxage=86400,must-revalidate",
          },
          {
            files: "_astro/**",
            cacheControl: "public,max-age=31536000,immutable",
          },
        ],
      },
      errorPage: "404.html",
    });

    return {
      url: site.url,
      stage: $app.stage,
    };
  },
});
