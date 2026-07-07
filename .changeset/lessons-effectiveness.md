---
'agentsmesh': minor
---

Lessons: measure effectiveness and sharpen recall

The lessons subsystem now tracks whether a recalled rule actually prevented the repeat, and improves recall precision — all opt-in and backward-compatible (no change to the CLI, MCP, or `lessons.json` surface):

- **Effectiveness signal (opt-in via `AGENTSMESH_LESSONS_TELEMETRY=1`).** An append-only outcome log records deliveries and failures; effectiveness is derived at read time — did a delivered lesson prevent the repeat? Recall **down-ranks** a lesson that fired but never helped, `lessons validate` gains advisory `INEFFECTIVE_LESSON` and `UNCOVERED_FAILURE` findings, and `lessons stats` gains a coarse **effectiveness block** (deliveries, held rate, ineffective count). The signal is deliberately coarse and labeled as such — never presented as proof of prevention.
- **Diff-aware recall.** The recall hook binds on the content being written, not just the file path, so a keyword lesson can fire on the change itself.
- **camelCase keyword reach.** Keyword recall now also splits camelCase/acronym identifier sub-words while retaining the whole token (fully backward compatible), so a keyword like `guard` reaches `useLeaveGuard.ts`.
- **Quieter injection.** Automatic recall caps the injected set to the most relevant few and stays silent on no match.
- **Recurrence-driven capture nudge.** A failure recurring on the same action with no covering lesson escalates the capture reminder, pre-filled from the real file/command.
- **Portable failure detection.** The recall hook records a failure from any tool event carrying an error payload, not only Claude Code's dedicated `PostToolUseFailure` event — so effectiveness can accumulate on more harnesses.
- **New capture warning `WIDE_GLOB_MATCH`** flags a `file_glob` that matches a large share of the working tree, complementing the existing structural broad-glob check.
- **`agentsmesh init --lessons`** now commits the `.gitattributes` binding for the `lessons.json` union merge driver and prints the per-clone `git config` setup, so a team's concurrent captures merge cleanly instead of conflicting.
