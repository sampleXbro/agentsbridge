---
'agentsmesh': patch
---

**`generate` no longer deletes files inside a managed directory that agentsmesh never wrote.**

`managedOutputs.dirs` was swept recursively and every file found that the current run did not emit was `rm -rf`'d. Those directories are shared: Kiro's Agent Hooks UI writes `.kiro/hooks/*.kiro.hook`, Cursor's rule generator writes `.cursor/rules/*.mdc`, users hand-author `~/.claude/skills/**`, and `.agents/skills` is the cross-tool skills convention. A single `generate` removed all of them — on a fresh project, the very first run did it before any lock existed.

This is the same ownership bug `coOwnedFiles` fixed for `managedOutputs.files`. Directories could not be fixed the same way because their contents are dynamic (one file per rule, command, agent, skill), so no descriptor can enumerate them. The lock's `outputs` map is the missing record: cleanup runs before the lock is rewritten, so the map on disk is still the previous run's list of everything agentsmesh generated.

A file discovered by the directory sweep is now deleted only when the previous run's lock says agentsmesh wrote it. Renaming a rule still evicts its old output. `managedOutputs.files` and `coOwnedFiles` are unchanged.

Two related fixes:

- **No provenance means no directory deletions.** A first run, a lock written before the `outputs` map existed, or a lock lost to `agentsmesh merge` leaves the sweep with nothing to go on, so it deletes nothing that run. Be aware this is not a one-run window: the lock a run writes records only what that run generated, so a file agentsmesh wrote earlier and no longer emits is never re-recorded and stays on disk indefinitely. Removing such an orphan is a manual step. That is the deliberate trade: an unwanted file that lingers is recoverable, a deleted one is not.
- **A filtered run (`--targets x`) leaves a configured-but-inactive target's directories alone.** `.agents/skills` is managed by amp, zed, goose, codex-cli and others, so `generate --targets zed` used to delete amp's generated skills. Provenance cannot tell them apart — agentsmesh did write them — so the guard is ownership: a directory another configured target also manages is skipped until the next unfiltered run.
- An empty run no longer wipes the lock's `outputs` map, which would have made everything already on disk permanently unevictable.

**`agentsmesh check` reports these files as a notice, not as drift.** Because `generate` no longer removes them, reporting them as stale generated output would exit 1 with no remedy — neither `agentsmesh merge` nor `generate --force` can clear a file agentsmesh does not own. They now appear under a new `outputsUntracked` list that is deliberately excluded from `outputDrift` and `inSync`:

```
✓ Lock file is in sync.
1 file(s) in managed directories were not written by agentsmesh (left untouched):
  .kiro/hooks/my-hook.kiro.hook
```

The signal is kept — a rule hand-added straight into `.claude/rules` instead of canonical still shows up — without turning a tool doing its job into a failed build. Four tests asserted the old exit-1 behaviour and were updated to the new contract rather than removed.

