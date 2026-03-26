#!/usr/bin/env bash
# agentsmesh-matcher: Edit|Write
# agentsmesh-command: eslint --fix
set -e
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
eslint --fix
