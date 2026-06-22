---
'agentsmesh': minor
---

Add an interactive `init` wizard. On an interactive TTY, `agentsmesh init` now asks which targets to generate for (the starter set is pre-checked), whether to import any detected tool configs, optionally whether to enable Lessons, and whether to run `generate` immediately — writing a tailored `agentsmesh.yaml`.

The wizard runs in both project and `--global` scope. In `--global` it restricts the target list to global-capable tools and skips the Lessons step entirely (lessons is project-only, enforced at the writer).

Fully backward compatible: the wizard is skipped and the original non-interactive behavior runs whenever `--yes`, `--json`, or a non-TTY/CI environment is detected. Scripted and CI usage is unchanged. Cancelling (Ctrl-C) at any prompt writes nothing.
