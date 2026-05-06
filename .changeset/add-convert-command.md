---
"agentsmesh": minor
---

feat(cli): add convert command for direct tool-to-tool migration

Adds `agentsmesh convert --from <source> --to <target>` for direct tool-to-tool conversion without going through canonical setup. Internally chains the existing import and generate pipelines via a temporary directory, producing destination tool files from source tool files in a single command. Supports `--dry-run` and `--json` flags.
