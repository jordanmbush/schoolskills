import { describe, expect, it } from "vitest";

import {
  awsAuthHint,
  awsIdentityLabel,
  awsProfileArgs,
  hasAmbientCredentials,
} from "./aws.mjs";

/**
 * These exist because of a real failure, not a hypothetical one.
 *
 * The geo-IP builder shipped with `--profile schoolskills` passed
 * unconditionally. It worked on a laptop and died on the first scheduled run
 * in GitHub Actions with "The config profile (schoolskills) could not be
 * found" — after spending four minutes downloading and merging 50MB of source
 * data, which it then threw away.
 *
 * The shape of the bug is what makes it worth pinning: it is invisible in
 * every environment where anyone would notice it, and only appears where a
 * profile is exactly the wrong way to authenticate.
 */

/** GitHub Actions after `aws-actions/configure-aws-credentials` has run. */
const RUNNER = {
  AWS_ACCESS_KEY_ID: "ASIAEXAMPLE",
  AWS_SECRET_ACCESS_KEY: "secret",
  AWS_SESSION_TOKEN: "token",
  AWS_REGION: "us-west-1",
  GITHUB_ACTIONS: "true",
};

/** A developer machine with an SSO profile and nothing exported. */
const LAPTOP = { HOME: "/Users/someone" };

describe("awsProfileArgs", () => {
  // The regression. A runner has no ~/.aws/config, so naming a profile is not
  // extra information — it replaces credentials that already work with a
  // pointer to a file that does not exist.
  it("names no profile when the environment already has credentials", () =>
    expect(awsProfileArgs(RUNNER)).toEqual([]));

  it("names the local profile when nothing else has supplied any", () =>
    expect(awsProfileArgs(LAPTOP)).toEqual(["--profile", "schoolskills"]));

  // Somebody who set AWS_PROFILE meant it, and it is how you point this at a
  // second account without editing code.
  it("lets an explicit AWS_PROFILE win over both", () => {
    expect(awsProfileArgs({ ...LAPTOP, AWS_PROFILE: "other" })).toEqual([
      "--profile",
      "other",
    ]);
    expect(awsProfileArgs({ ...RUNNER, AWS_PROFILE: "other" })).toEqual([
      "--profile",
      "other",
    ]);
  });

  it.each([
    ["AWS_ACCESS_KEY_ID", { AWS_ACCESS_KEY_ID: "AKIA" }],
    ["AWS_SESSION_TOKEN", { AWS_SESSION_TOKEN: "t" }],
    ["AWS_WEB_IDENTITY_TOKEN_FILE", { AWS_WEB_IDENTITY_TOKEN_FILE: "/f" }],
    [
      "AWS_CONTAINER_CREDENTIALS_FULL_URI",
      { AWS_CONTAINER_CREDENTIALS_FULL_URI: "http://x" },
    ],
    [
      "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
      { AWS_CONTAINER_CREDENTIALS_RELATIVE_URI: "/x" },
    ],
  ])("treats %s as ambient credentials", (_name, env) =>
    expect(hasAmbientCredentials(env)).toBe(true),
  );

  it("does not mistake an empty environment for credentials", () =>
    expect(hasAmbientCredentials({})).toBe(false));
});

describe("the message when authentication fails", () => {
  // "Could not reach AWS as profile schoolskills" on a runner that never used
  // a profile sends whoever opens the failed job looking for a config file
  // instead of at the role.
  it("does not claim a profile on a runner", () => {
    expect(awsIdentityLabel(RUNNER)).toBe("the credentials in the environment");
    expect(awsAuthHint(RUNNER)).toMatch(/OIDC/);
    expect(awsAuthHint(RUNNER)).not.toMatch(/sso login/);
  });

  it("suggests an SSO login on a laptop", () => {
    expect(awsIdentityLabel(LAPTOP)).toBe('profile "schoolskills"');
    expect(awsAuthHint(LAPTOP)).toMatch(/aws sso login --profile schoolskills/);
  });
});
