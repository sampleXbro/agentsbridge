#!/usr/bin/env bash
# agentsbridge-matcher: Edit|Write
# agentsbridge-command: eslint --fix
set -e
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
eslint --fix
