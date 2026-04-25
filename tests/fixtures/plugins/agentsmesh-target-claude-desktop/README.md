# AgentsMesh Target: Claude Desktop

Sync your AgentsMesh configuration into Claude Desktop's native config.

## What It Does

This plugin generates Claude Desktop configuration (`~/.claude/claude.json`) from your AgentsMesh canonical rules and agents:

- **Root Rule** → Claude Desktop system instruction (default profile)
- **Agents** → Named profiles you can switch between in Claude Desktop UI
- Validates that you have at least a root rule defined

## Installation

```bash
agentsmesh plugin add agentsmesh-target-claude-desktop
```

Then update your `agentsmesh.yaml` to enable the target:

```yaml
version: 1
targets: []
pluginTargets:
  - claude-desktop
features:
  - rules
  - agents
```

## Usage

Generate Claude Desktop config from your canonical rules:

```bash
agentsmesh generate
```

This creates `~/.claude/claude.json` with your rules and agents.

In Claude Desktop, you'll see your agents as selectable profiles in the UI.

## Global Mode

To manage Claude Desktop config at the home level (without a project):

```bash
agentsmesh init --global
agentsmesh plugin add agentsmesh-target-claude-desktop --global
agentsmesh generate --global
```

## Configuration Example

Create a root rule at `.agentsmesh/rules/_root.md`:

```markdown
---
root: true
description: My coding assistant rules
---

# My Assistant

You are a coding assistant. Always:
- Write clear, well-tested code
- Ask for clarification when requirements are ambiguous
- Suggest improvements to existing code
```

Create agents at `.agentsmesh/agents/code-reviewer.md`:

```markdown
---
name: Code Reviewer
description: Reviews code for quality
---

You are an expert code reviewer. Focus on:
- Test coverage
- Performance
- Readability
- Security best practices
```

Run `agentsmesh generate` to sync to Claude Desktop.

## Limitations

- **Commands, Skills, MCP, Hooks, Permissions**: Not directly supported in Claude Desktop native format. Use AgentsMesh with other targets for those.
- **Import**: Claude Desktop config cannot be imported back into AgentsMesh (one-way sync). Users edit `~/.claude/claude.json` directly or use Claude Desktop UI.

## Contributing

Issues and PRs welcome at [your-repo-url].

## License

MIT
