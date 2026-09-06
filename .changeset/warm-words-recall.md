---
'agentsmesh': minor
---

**Added — lexical retrieval on task text.** A keyword-only recall — the `UserPromptSubmit` hook, `agentsmesh lessons query --keyword`, and the MCP `lessons_query` keyword path — now also reaches lessons by the wording of their rule, scored with the ranker's existing BM25. A conceptual lesson fires when the prompt says the same thing in different words than its keyword trigger. Up to three wording matches join the candidates when a rule shares at least two distinct, non-generic terms with the task text; they rank below every triggered lesson, respect the usual caps, and are labelled `lexical: true` in `--json` output and counted as `matchedByKind.text` in the recall log. It never runs for a file or command query. Zero new dependencies, about a millisecond per call.
