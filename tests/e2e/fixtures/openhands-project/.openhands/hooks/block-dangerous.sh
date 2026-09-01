#!/usr/bin/env bash
# PreToolUse hook: refuse recursive deletes outside the workspace.
# Exit code 2 blocks the tool call; 0 allows it. The event payload arrives on
# stdin, and OPENHANDS_TOOL_NAME / OPENHANDS_PROJECT_DIR are set by the executor.
set -euo pipefail

payload="$(cat)"

if grep -qE 'rm[[:space:]]+-[a-zA-Z]*[rR]' <<<"$payload"; then
  if ! grep -qF "$OPENHANDS_PROJECT_DIR" <<<"$payload"; then
    echo "Refusing a recursive delete outside $OPENHANDS_PROJECT_DIR" >&2
    exit 2
  fi
fi

exit 0
