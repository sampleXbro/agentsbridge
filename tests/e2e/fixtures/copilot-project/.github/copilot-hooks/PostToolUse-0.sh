#!/usr/bin/env bash
set -euo pipefail

if [ -n "${FILE_PATH:-}" ] && [ -f "$FILE_PATH" ]; then
  prettier --write "$FILE_PATH"
fi
