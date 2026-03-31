#!/usr/bin/env bash
# agentsmesh-matcher: Edit|Write
# agentsmesh-command: jq -r '.tool_input.file_path' | xargs eslint --fix
set -e
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
jq -r '.tool_input.file_path' | xargs eslint --fix
