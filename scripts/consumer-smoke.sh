#!/usr/bin/env bash
# Consumer smoke test: pack agentsmesh, install into a throwaway TS project,
# and run `tsc --noEmit` under strict mode. Catches TS7016 and missing type
# exports before they ship to npm.
#
# Run from repo root: ./scripts/consumer-smoke.sh
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
FIXTURE="$REPO_ROOT/tests/consumer-smoke"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK" "$REPO_ROOT"/agentsmesh-*.tgz' EXIT

cd "$REPO_ROOT"

echo "→ pnpm build"
pnpm build >/dev/null

echo "→ pnpm pack"
pnpm pack >/dev/null
TARBALL=$(ls -1t "$REPO_ROOT"/agentsmesh-*.tgz | head -n 1)
if [[ ! -f "$TARBALL" ]]; then
  echo "✗ Expected tarball not found after pnpm pack" >&2
  exit 1
fi

echo "→ Copy fixture to $WORK"
cp -R "$FIXTURE"/. "$WORK/"
cd "$WORK"

echo "→ npm install agentsmesh tarball + typescript"
npm install --silent --no-audit --no-fund "$TARBALL" typescript@5 >/dev/null

echo "→ tsc --noEmit (strict mode consumer simulation)"
./node_modules/.bin/tsc --noEmit

echo "✓ Consumer smoke OK — agentsmesh resolves with types under strict TS"
