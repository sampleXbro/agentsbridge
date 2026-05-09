---
"agentsmesh": minor
---

Add 6 P0-TierA targets: Aider, Amazon Q Developer, Augment Code, Crush, Qwen Code, and Trae

New built-in targets with full project and global mode support:

- **Aider** — `CONVENTIONS.md`, `.aider/skills/`, `.aiderignore`
- **Amazon Q Developer** — `.amazonq/rules/*.md`, `.amazonq/mcp.json`
- **Augment Code** — `.augment/rules/`, `.augment/commands/`, `.augment/skills/`, `.augment/settings.json`, `.augmentignore`
- **Crush** — `CRUSH.md`, `.crush/skills/`, `crush.json` (MCP + hooks + permissions), `.crushignore`
- **Qwen Code** — `QWEN.md`, `.qwen/rules/`, `.qwen/commands/`, `.qwen/agents/`, `.qwen/skills/`, `.qwen/settings.json`, `.qwenignore`
- **Trae** — `.trae/rules/`, `.trae/skills/`, `.trae/mcp.json`, `.trae/.ignore`

All targets include: descriptor, generator, importer, linter, import-map, fixtures, unit tests, global-layout tests, contract definitions, and branch coverage tests. Catalog grows from 18 to 24 builtin targets.
