#!/usr/bin/env bash
# agentsmesh-matcher: Edit|Write
# agentsmesh-command: jq -r '.tool_input.file_path' | xargs eslint --fix
set -e
jq -r '.tool_input.file_path' | xargs eslint --fix
