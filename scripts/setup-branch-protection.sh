#!/usr/bin/env bash
# Branch protection for `develop` and `main`.
#
# This is available here because the repo is PUBLIC — monilibrium_2 is private
# on the Free plan, where branch protection isn't offered, which is why that
# repo leans on husky hooks and a main-only CI. Here CI can genuinely gate a
# merge, so it does.
#
# `main` is stricter than `develop`: main is what deploys.
#
# Usage: bash scripts/setup-branch-protection.sh
set -euo pipefail

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
echo "Protecting branches on ${REPO}…"

protect() {
  local branch="$1" reviews="$2"
  # `enforce_admins: false` on purpose — it's a solo repo, and locking the only
  # maintainer out of their own hotfix path is not a safety feature.
  gh api -X PUT "repos/${REPO}/branches/${branch}/protection" \
    --input - <<JSON >/dev/null
{
  "required_status_checks": { "strict": true, "contexts": ["CI"] },
  "enforce_admins": false,
  "required_pull_request_reviews": ${reviews},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "required_conversation_resolution": true
}
JSON
  echo "  ✓ ${branch}"
}

# develop: CI must pass, but no review requirement — a solo author can't
# approve their own PR, and requiring one would just mean bypassing it daily.
protect develop 'null'

# main: same gate. Deliberately NOT required_linear_history — releases are
# develop → main MERGE commits; squashing diverges the branches permanently.
protect main 'null'

echo
echo "Done. CI is now a required check on both branches."
echo "Releases: merge develop → main with a merge commit (never squash)."
