#!/usr/bin/env bash
# GitHub→AWS OIDC deploy credentials.
#
# Lets GitHub Actions assume an AWS role via OIDC — short-lived STS credentials
# per workflow run, no long-lived `AWS_ACCESS_KEY_ID` in GitHub secrets.
# Idempotent; safe to re-run after editing the policy below.
#
# Provisions:
#   1. The GitHub OIDC identity provider (account-wide singleton).
#   2. The deploy role, trust-scoped to THIS repo's main + develop refs.
#      develop must ALSO be trusted: a `workflow_run`-triggered job runs
#      associated with the repo's DEFAULT branch, so the deploy job's OIDC
#      token presents `ref:refs/heads/develop` even when the CI run that
#      triggered it was the post-merge run on main. Omitting it fails the
#      first release deploy with AssumeRoleWithWebIdentity denied — a mistake
#      already paid for once in monilibrium_2.
#
#      ⚠️ Debugging a denied assume-role: the error GitHub prints ("Not
#      authorized to perform sts:AssumeRoleWithWebIdentity") never says which
#      claim failed, and the token isn't in the log. CloudTrail has it —
#      the denied event records the exact subject as the principal id:
#        aws cloudtrail lookup-events --profile schoolskills --region us-west-1 \
#          --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
#          --max-results 1 --query 'Events[].CloudTrailEvent' --output text | jq .userIdentity
#      That is how the immutable-subject mismatch below was found, after the
#      first two production deploys failed identically.
#   3. A least-privilege deploy policy, attached to the role.
#   4. The `AWS_DEPLOY_ROLE_ARN` repo VARIABLE (not a secret — role ARNs
#      aren't sensitive) that deploy.yml reads.
#
# Scope note: this is a STATIC site — S3 + CloudFront + ACM, plus a CloudWatch
# dashboard to look at the traffic. The allowlist is correspondingly small.
# ⚠️ Adding a component that reaches a NEW AWS service means adding that
# service here and re-running. A local `sst deploy` will NOT catch the gap,
# because the local profile is Admin — the AccessDenied surfaces for the first
# time in the production deploy. That is not hypothetical: the traffic
# dashboard was written, type-checked, validated against CloudWatch and merged
# before anyone discovered the deploy role could not call PutDashboard.
#
# Requires admin credentials for the School Skills account.
# Usage: bash scripts/setup-github-oidc.sh
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-schoolskills}"

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
# GitHub now issues IMMUTABLE OIDC subjects: the numeric owner and repository
# ids are interpolated into the sub, so the claim reads
#   repo:owner@34669268/name@1332338472:ref:refs/heads/main
# rather than the documented `repo:owner/name:ref:...`. The ids are what make
# it immutable — renaming the repo or the account can't be used to inherit
# another repo's trust. Both forms are trusted below so the role keeps working
# whichever one GitHub presents; `sub` is matched with StringEquals against
# exact strings, never a wildcard.
# ⚠️ `gh repo view --json id` returns the GraphQL NODE id ("R_kgDO…"), not the
# numeric database id, so `--jq .databaseId` yields an EMPTY string rather than
# failing — which means a `||` fallback never fires. That silently produced
# `repo:owner@34669268/schoolskills@:ref:refs/heads/main`, a trust policy that
# applies cleanly and then denies every deploy with an error that names no
# claim. Test for emptiness, not for exit status.
REPO_ID="$(gh api "repos/${REPO}" --jq .id)"
OWNER_ID="$(gh api "repos/${REPO}" --jq .owner.id)"

# Both ids are interpolated into a `sub` matched with StringEquals, so a blank
# or non-numeric value cannot fail loudly later — it just builds a subject that
# nothing will ever present. Refuse to write the trust policy at all.
for pair in "REPO_ID=${REPO_ID}" "OWNER_ID=${OWNER_ID}"; do
  case "${pair#*=}" in
    "" | *[!0-9]*)
      echo "Refusing to write a trust policy: ${pair%%=*} is not numeric (\"${pair#*=}\")." >&2
      echo "Without it the subject silently loses its id and every deploy is denied." >&2
      exit 1
      ;;
  esac
done
REPO_IMMUTABLE="${REPO%%/*}@${OWNER_ID}/${REPO##*/}@${REPO_ID}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROLE_NAME="github-actions-schoolskills-deploy"
POLICY_NAME="github-actions-schoolskills-deploy"
PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo "Setting up GitHub→AWS OIDC for ${REPO} in account ${ACCOUNT_ID}…"

# ── 0. Guard: no long-lived AWS keys may live in GitHub secrets ──────────────
if gh secret list --json name --jq '.[].name' 2>/dev/null |
  grep -qE '^AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN)$'; then
  echo "✗ Long-lived AWS credentials found in GitHub secrets — delete them" >&2
  echo "  (gh secret delete AWS_ACCESS_KEY_ID …); OIDC replaces them." >&2
  exit 1
fi

# ── 1. GitHub OIDC identity provider ─────────────────────────────────────────
# AWS validates this provider against its own trust store now and ignores the
# thumbprints, but the create call still requires the field.
if aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn "$PROVIDER_ARN" >/dev/null 2>&1; then
  echo "OIDC provider already exists: ${PROVIDER_ARN}"
else
  aws iam create-open-id-connect-provider \
    --url "https://token.actions.githubusercontent.com" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list \
    "6938fd4d98bab03faadb97b34396831e3780aea1" \
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd" >/dev/null
  echo "Created OIDC provider: ${PROVIDER_ARN}"
fi

# ── 2. Deploy role ───────────────────────────────────────────────────────────
TRUST_POLICY="$(
  cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "${PROVIDER_ARN}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": [
            "repo:${REPO_IMMUTABLE}:ref:refs/heads/main",
            "repo:${REPO_IMMUTABLE}:ref:refs/heads/develop",
            "repo:${REPO}:ref:refs/heads/main",
            "repo:${REPO}:ref:refs/heads/develop"
          ]
        }
      }
    }
  ]
}
JSON
)"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST_POLICY"
  aws iam update-role --role-name "$ROLE_NAME" --max-session-duration 3600
  echo "Updated role trust policy: ${ROLE_NAME}"
else
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --description "GitHub Actions OIDC deploy role for ${REPO} (sst deploy; main + develop refs only)" \
    --max-session-duration 3600 \
    --assume-role-policy-document "$TRUST_POLICY" >/dev/null
  echo "Created role: ${ROLE_ARN}"
fi

# ── 3. Least-privilege deploy policy ─────────────────────────────────────────
# Pulumi auto-names roles `<LogicalName>Role-<suffix>` after the top-level
# components in sst.config.ts, plus `schoolskills-*` for anything SST names via
# its app-stage prefix. When a name would exceed IAM's 64-char limit SST drops
# the app name and truncates the stage to 5 chars, hence `produ-*`/`dev-*`.
# ⚠️ A new top-level component that creates a role means extending this list.
IAM_RESOURCE_PATTERNS="$(
  cat <<JSON
        "arn:aws:iam::${ACCOUNT_ID}:role/Site*",
        "arn:aws:iam::${ACCOUNT_ID}:role/schoolskills-*",
        "arn:aws:iam::${ACCOUNT_ID}:role/produ-*",
        "arn:aws:iam::${ACCOUNT_ID}:role/dev-*"
JSON
)"

# The cloudwatch entries are named actions rather than `cloudwatch:*` on
# purpose: the only thing deployed here is one dashboard, and the wildcard
# would also hand the deploy role every alarm and metric in the account.
# Dashboard actions take no resource ARN, so "*" is the only resource they can
# have — the narrowing has to happen on the action.
DEPLOY_POLICY="$(
  cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DeployServices",
      "Effect": "Allow",
      "Action": [
        "acm:*",
        "cloudfront:*",
        "cloudfront-keyvaluestore:*",
        "cloudwatch:DeleteDashboards",
        "cloudwatch:GetDashboard",
        "cloudwatch:ListDashboards",
        "cloudwatch:PutDashboard",
        "lambda:*",
        "logs:*",
        "s3:*",
        "ssm:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SstRoleManagement",
      "Effect": "Allow",
      "Action": [
        "iam:AttachRolePolicy",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:DeleteRolePolicy",
        "iam:DetachRolePolicy",
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:ListAttachedRolePolicies",
        "iam:ListRolePolicies",
        "iam:ListRoleTags",
        "iam:PutRolePolicy",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:UpdateAssumeRolePolicy",
        "iam:UpdateRole",
        "iam:UpdateRoleDescription"
      ],
      "Resource": [
${IAM_RESOURCE_PATTERNS}
      ]
    },
    {
      "Sid": "SstPassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
${IAM_RESOURCE_PATTERNS}
      ],
      "Condition": {
        "StringEquals": { "iam:PassedToService": ["lambda.amazonaws.com", "edgelambda.amazonaws.com"] }
      }
    },
    {
      "Sid": "ServiceLinkedRoles",
      "Effect": "Allow",
      "Action": ["iam:CreateServiceLinkedRole", "iam:GetRole"],
      "Resource": "arn:aws:iam::*:role/aws-service-role/*"
    }
  ]
}
JSON
)"

if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
  # Managed policies hold at most 5 versions — prune oldest non-default first.
  while [ "$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" \
    --query 'length(Versions)' --output text)" -ge 5 ]; do
    OLDEST="$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" \
      --query 'sort_by(Versions[?!IsDefaultVersion], &CreateDate)[0].VersionId' --output text)"
    aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$OLDEST"
  done
  aws iam create-policy-version --policy-arn "$POLICY_ARN" \
    --policy-document "$DEPLOY_POLICY" --set-as-default >/dev/null
  echo "Published new default version of policy: ${POLICY_NAME}"
else
  aws iam create-policy --policy-name "$POLICY_NAME" \
    --description "Least-privilege sst deploy permissions for the GitHub Actions OIDC role (static site: S3 + CloudFront + ACM)" \
    --policy-document "$DEPLOY_POLICY" >/dev/null
  echo "Created policy: ${POLICY_ARN}"
fi

aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$POLICY_ARN"

# ── 4. Publish the role ARN for deploy.yml ───────────────────────────────────
gh variable set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN"

echo "Done. GitHub Actions can assume: ${ROLE_ARN}"
