---
'agentsmesh': patch
---

Fix interactive prompts hanging behind the status spinner. `install`, `uninstall`, and `refresh` held the spinner across the whole run, and its redraw timer overwrote the interactive prompts underneath (skill-pack select, broken-link, invalid-resource confirm, uninstall drift, and the refresh consent prompt) — leaving the command waiting on invisible input (refresh silently timed out after 5 minutes and skipped the pack). The spinner now yields the terminal to the prompt flow whenever a run may prompt (real TTY, no `--force`/`--dry-run`), mirroring `init`.

Also hardened the prompt primitives: `confirm()` now reuses the shared `readLine` helper so a closed or erroring stdin declines gracefully instead of hanging (Ctrl-D) or crashing; `readLine` resolves to empty (decline) on a stream `error` instead of throwing. And `install --force --dry-run` now previews the same resource set a real `--force` install would write (invalid resources were incorrectly dropped from the preview).
