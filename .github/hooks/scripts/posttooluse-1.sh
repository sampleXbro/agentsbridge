#!/usr/bin/env bash
# agentsmesh-matcher: Edit|Write|Bash
# agentsmesh-command: agentsmesh lessons hook
set -eu
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
agentsmesh lessons hook
