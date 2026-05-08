#!/usr/bin/env bash
# agentsmesh-event: PreToolUse
# agentsmesh-matcher: Bash
# agentsmesh-command: echo "Running: $(jq -r '.tool_input.command' < /dev/stdin)"
set -eu
echo "Running: $(jq -r '.tool_input.command' < /dev/stdin)"
