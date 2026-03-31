#!/usr/bin/env bash
# agentsmesh-matcher: Bash
# agentsmesh-command: echo "Running: $(jq -r '.tool_input.command' < /dev/stdin)"
set -e
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Running: $(jq -r '.tool_input.command' < /dev/stdin)"
