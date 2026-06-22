---
'agentsmesh': minor
---

Add an interactive `init` wizard. On a project-scope TTY, `agentsmesh init` now asks which targets to generate for (the starter set is pre-checked), whether to enable Lessons (default yes), whether to import any detected tool configs, and whether to run `generate` immediately — writing a tailored `agentsmesh.yaml`.

The wizard is fully backward compatible: it is skipped and the original non-interactive behavior runs whenever `--yes`, `--json`, `--global`, or a non-TTY/CI environment is detected. Scripted and CI usage is unchanged. Cancelling (Ctrl-C) at any prompt writes nothing.
