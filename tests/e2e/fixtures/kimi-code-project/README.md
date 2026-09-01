# Orders API

Fixture project for Kimi Code CLI import coverage: a small Express + TypeScript
service configured the way the CLI documents it.

- `AGENTS.md` — repository instructions (Kimi Code prefers it over `.kimi-code/AGENTS.md`)
- `.kimi-code/agents/` — sub-agent definitions
- `.kimi-code/skills/` — skill bundles, including a command projected as `am-command-review`
- `.kimi-code/mcp.json` — project-scope MCP servers

Hooks and permission rules are not here on purpose: Kimi Code reads those only
from the user-level `~/.kimi-code/config.toml`.

## Scripts

```bash
pnpm dev     # start the API on :4000
pnpm test    # vitest
pnpm openapi # regenerate the OpenAPI snapshot
```
