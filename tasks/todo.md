# Lexical retrieval on prompt submit (2026-09-06)

Goal: conceptual lessons reachable by their wording, not only by a keyword
trigger, on the paths that carry task text: the UserPromptSubmit hook and the
task-start `lessons query --keyword` / MCP keyword recall. Never on the
per-tool-call path (file/command queries), where precision was just repaired.

- [x] extract recordRecallTelemetry to recall-telemetry.ts (recall.ts is at 200)
- [x] lexical-retrieval.ts: isKeywordOnlyQuery, lexicalCandidates(graph, keyword, exclude)
      BM25 over active, non-always rule text; >= 2 distinct query terms present;
      cap 3; excluded ids skipped; provenance flag on MatchedLesson
- [x] recall.ts: keyword-only => candidates = trigger matches + lexical
- [x] ranking: lexical flag rides into RankReason (specificity stays 0 => below triggers)
- [x] telemetry: matchedByKind.text = lexical candidate count
- [x] tests first: unit (module), recall-level (keyword-only vs file+keyword,
      ordering, telemetry), hook UserPromptSubmit injection
- [x] docs: reference/lessons.mdx recall semantics, cli/lessons.mdx; changeset
- [ ] gate: full suite + floor, lint, knip, docs build; measure on real graph; commit; push

## Verified on the real graph (493 active lessons)
- keyword-only recall latency unchanged at 0.20s including BM25 over every rule
- prompt "the hero animation dots were parked in the top left corner before the
  svg clock started": before the generic-word gate, a merge-conflict-marker rule
  qualified on "top" + "left"; after it, only the SVG animation lesson returns
- CLI handler wired through the same matchLessons step as recallLessons, so the
  hook, CLI and MCP paths cannot drift; `lexical: true` in --json, stderr notice
