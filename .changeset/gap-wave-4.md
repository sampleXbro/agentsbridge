---
'agentsmesh': minor
---

**The last nine capability gaps closed across six targets — and four fixes to config-destroying behaviour.**

**kiro** — permissions at both scopes. Global writes `~/.kiro/settings/permissions.yaml` with canonical allow/deny/ask mapping straight onto Kiro's `effect`. Project embeds into the `.kiro/agents/<name>.md` frontmatter agentsmesh already writes, because Kiro stores workspace rules outside the repository and a cloned repo cannot inject permissions. Lint says so, and says that embedded rules apply only while that agent is active.

**pi-agent** — permissions at both scopes via `defaultTools` in `.pi/settings.json` and `~/.pi/agent/settings.json`. The mapping is deliberately narrow: Pi has an allow-list over eight built-in tools and no deny, ask, path or command matching, so every canonical entry that cannot be expressed is named in a lint warning.

**aider** — hooks at both scopes via `lint-cmd` and `auto-lint` in `.aider.conf.yml`. Only those two of the five candidate keys map honestly from canonical hooks; the rest are warned about rather than faked.

**goose** — project MCP via `.agents/plugins/agentsmesh/.mcp.json`. **replit-agent** — commands and agents project onto the repo-committed `.agents/skills/` surface, byte-identical to codex-cli's output so the two dedupe rather than collide.

**trae** — global permissions were investigated and left at `partial`, not raised. Trae's `~/.trae/permission/global.json` is real, but canonical allow/deny/ask does not map onto its `resourceAuthorization` / `commandRules` split faithfully enough to call native. The gap stays open and visible in the audit rather than being closed dishonestly.

Four fixes to behaviour that was already shipping:

- **Goose project MCP erased `cwd` and any hand-added server key.** MCP went through the one emission path that passes no merge callback, so the file was rewritten wholesale. Both scopes now route through merge-capable paths; `cwd`, `timeout`, `$schema` and unknown keys survive.
- **Deleting pi-agent permissions silently widened access.** Removing `defaultTools` handed every built-in back, including `bash` and `write`. An empty canonical list now writes `defaultTools: []`, which fails closed.
- **Kiro generation overwrote hand-written permission rules.** Ownership is now per rule: a rule is agentsmesh's only when its keys are a subset of `{capability, match, effect}` and it projects back onto canonical, so `exclude` protections and unknown capabilities survive with their comments.
- **`.aider.conf.yml` had two writers competing.** It now has one, and every key agentsmesh owns carries a generated-by marker comment — so an `auto-lint: false` you set by hand is never flipped, and only marked keys are removed when they leave the projection.

Kiro and pi-agent imports also stopped overwriting canonical: silence about `deny` is no longer read as revocation of `deny`, so a Kiro file holding only allow rules can no longer drop `Read(./.env)` from canonical and cross-contaminate every other target.
