---
'agentsmesh': patch
---

Restructure the generation contract paragraph to lead with an explicit **NEVER edit generated files** prohibition naming the generated paths (`.claude/`, `.cursor/`, `AGENTS.md`, etc.), followed by **All changes MUST go through `.agentsmesh` first**. Agents were initially understanding the contract but forgetting it over multi-step conversations — front-loading the prohibition makes it stickier. All legacy contract body versions (v1-v10) remain detected for safe in-place upgrade.
