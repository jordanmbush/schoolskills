#!/usr/bin/env node
/**
 * How the analytics scripts talk to the AWS CLI.
 *
 * One job: decide whether to pass `--profile`, which is not the same question
 * on a laptop as it is on a CI runner.
 *
 * ⚠️ **Never hardcode `--profile` again.** The first version of the geo-IP
 * builder did — `AWS_PROFILE ?? "schoolskills"`, passed unconditionally — and
 * it worked perfectly on a developer machine and failed on the very first
 * scheduled run in GitHub Actions:
 *
 *     aws: [ERROR]: The config profile (schoolskills) could not be found
 *
 * A named profile is a lookup into `~/.aws/config`. A runner has no such file.
 * It has AMBIENT credentials instead: `aws-actions/configure-aws-credentials`
 * exchanges the OIDC token and exports `AWS_ACCESS_KEY_ID` and friends into the
 * environment, where the CLI's default credential chain finds them without
 * being told anything. Passing `--profile` there does not add information — it
 * overrides working credentials with a pointer to a file that does not exist.
 *
 * So the rule is: name a profile only when nothing else has already supplied
 * credentials.
 */

/**
 * The profile to use locally, when nobody has said otherwise.
 *
 * Matches the profile name in docs/analytics.md and the one `aws sso login`
 * is run against. `AWS_PROFILE` overrides it for anyone whose local config
 * calls it something else.
 */
const LOCAL_PROFILE = "schoolskills";

/**
 * True when the environment has already handed the CLI credentials.
 *
 * Covers the two shapes that actually occur: exported static/session keys
 * (what `configure-aws-credentials` leaves behind, and what `AWS_PROFILE=…
 * aws sso export` style setups produce), and the web-identity variables a
 * container or pod-identity setup exports instead.
 */
export const hasAmbientCredentials = (env = process.env) =>
  Boolean(
    env.AWS_ACCESS_KEY_ID ||
    env.AWS_SESSION_TOKEN ||
    env.AWS_WEB_IDENTITY_TOKEN_FILE ||
    env.AWS_CONTAINER_CREDENTIALS_FULL_URI ||
    env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI,
  );

/**
 * The `--profile …` pair to splice into an `aws` argument list, or nothing.
 *
 * Returned as an array so a caller can spread it unconditionally:
 *
 *     execFileSync("aws", ["s3", "cp", from, to, ...awsProfileArgs()])
 *
 * An explicit `AWS_PROFILE` always wins — somebody who set it meant it, and it
 * is also how you point this at a second account without editing code.
 */
export const awsProfileArgs = (env = process.env) => {
  if (env.AWS_PROFILE) return ["--profile", env.AWS_PROFILE];
  if (hasAmbientCredentials(env)) return [];
  return ["--profile", LOCAL_PROFILE];
};

/**
 * How to describe the current credentials in an error message.
 *
 * "Could not reach AWS as profile schoolskills" is exactly the wrong thing to
 * print on a runner that never used a profile — it sends whoever is reading
 * the failed job off looking for a config file rather than at the role.
 */
export const awsIdentityLabel = (env = process.env) => {
  const [, profile] = awsProfileArgs(env);
  return profile
    ? `profile "${profile}"`
    : "the credentials in the environment";
};

/**
 * What to suggest when the CLI cannot authenticate.
 *
 * Different advice for the two worlds, for the same reason as above: an
 * expired SSO session is a laptop problem, and a role that cannot be assumed
 * is a workflow problem.
 */
export const awsAuthHint = (env = process.env) => {
  const [, profile] = awsProfileArgs(env);
  return profile
    ? `If the session has expired:  aws sso login --profile ${profile}`
    : "Check that the workflow's OIDC step ran and that AWS_DEPLOY_ROLE_ARN is set.";
};
