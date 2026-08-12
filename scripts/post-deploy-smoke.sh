#!/usr/bin/env bash
# Post-deploy smoke checks against the live origin.
#
# Deliberately narrow: this asks "did a working site actually land at this
# URL", not "does the game work" — the browser suite in CI already covers the
# game against the same build artefact. What can only break HERE is the
# delivery: DNS, the certificate, cache headers, the error document.
#
# Usage: bash scripts/post-deploy-smoke.sh https://schoolskills.app
set -euo pipefail

BASE="${1:?usage: post-deploy-smoke.sh <base-url>}"
fails=0

check() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ ${label}"
  else
    echo "  ✗ ${label} — got '${actual}', want '${expected}'"
    fails=$((fails + 1))
  fi
}

echo "Smoke-testing ${BASE}"

status() { curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "$1"; }

check "landing page serves"        "$(status "${BASE}/")"                    "200"
check "game page serves"           "$(status "${BASE}/flash-cards")"         "200"
check "a times-table page serves"  "$(status "${BASE}/multiplication/7-times-table")" "200"
check "sitemap serves"             "$(status "${BASE}/sitemap-index.xml")"   "200"
check "robots serves"              "$(status "${BASE}/robots.txt")"          "200"
check "manifest serves"            "$(status "${BASE}/manifest.webmanifest")" "200"
# These four caught a real outage: a custom `fileOptions` list in sst.config.ts
# replaced SST's default `**` catch-all, so every file not matching a listed
# pattern was never uploaded. Pages all served fine; the PWA, the icons and the
# social card were simply absent. Check one of each shape that isn't a document.
check "service worker serves"      "$(status "${BASE}/sw.js")"               "200"
check "favicon serves"             "$(status "${BASE}/favicon.svg")"         "200"
check "apple touch icon serves"    "$(status "${BASE}/apple-touch-icon.png")" "200"
check "OG card serves"             "$(status "${BASE}/og-default.png")"      "200"
# A missing error document makes CloudFront answer 502 instead of 404 — which
# is exactly what happened the first time this site was deployed.
check "unknown path 404s (not 502)" "$(status "${BASE}/definitely-not-a-page")" "404"

# The title is the cheapest proof we're serving OUR site and not a parked page
# or a stale distribution.
if curl -sS --max-time 20 "${BASE}/" | grep -q "School Skills"; then
  echo "  ✓ landing page contains the site name"
else
  echo "  ✗ landing page does not contain the site name"
  fails=$((fails + 1))
fi

# HTML must revalidate. If it ever ships immutable, a deploy becomes invisible
# for up to a year and no amount of redeploying fixes it for existing visitors.
cache="$(curl -sSI --max-time 20 "${BASE}/" | tr -d '\r' | grep -i '^cache-control:' | head -1)"
if echo "$cache" | grep -qi "must-revalidate"; then
  echo "  ✓ HTML is revalidated (${cache# })"
else
  echo "  ✗ HTML cache-control lacks must-revalidate: ${cache:-<none>}"
  fails=$((fails + 1))
fi

if [ "$fails" -gt 0 ]; then
  echo "✗ ${fails} smoke check(s) failed"
  exit 1
fi
echo "✓ all smoke checks passed"
