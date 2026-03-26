import { describe, it } from 'vitest';
import { expectScope } from './native-install-scope.helpers.js';

describe('stageNativeInstallScope Codex CLI', () => {
  it.each([
    {
      name: 'codex-root',
      target: 'codex-cli',
      path: 'AGENTS.md',
      files: { 'AGENTS.md': '# Codex Root\n' },
      features: ['rules'],
      pick: { rules: ['_root'] },
    },
    {
      name: 'codex-scoped-agents-file',
      target: 'codex-cli',
      path: 'src/AGENTS.md',
      files: { 'src/AGENTS.md': '# Scoped instructions\n' },
      features: ['rules'],
      pick: { rules: ['src'] },
    },
    {
      name: 'codex-command-skill-folder',
      target: 'codex-cli',
      path: '.agents/skills/am-command-review',
      files: {
        'AGENTS.md': '# Root\n',
        '.agents/skills/am-command-review/SKILL.md':
          '---\ndescription: Review changes\nx-agentsmesh-kind: command\nx-agentsmesh-name: review\n---\n\nReview diff.\n',
      },
      features: ['commands'],
      pick: { commands: ['review'] },
    },
    {
      name: 'codex-skill-folder',
      target: 'codex-cli',
      path: '.agents/skills/demo',
      files: {
        'AGENTS.md': '# Root\n',
        '.agents/skills/demo/SKILL.md': '---\ndescription: Demo\n---\n\nUse demo.\n',
      },
      features: ['skills'],
      pick: { skills: ['demo'] },
    },
    {
      name: 'codex-agent-file',
      target: 'codex-cli',
      path: '.codex/agents/pr-explorer.toml',
      files: {
        'AGENTS.md': '# Root\n',
        '.codex/agents/pr-explorer.toml':
          'name = "pr-explorer"\ndescription = "Explore PRs"\nmodel = "gpt-5.3-codex-spark"\ndeveloper_instructions = "Focus on risk."\n',
      },
      features: ['agents'],
      pick: { agents: ['pr-explorer'] },
    },
    {
      name: 'codex-mcp-file',
      target: 'codex-cli',
      path: '.codex/config.toml',
      files: {
        '.codex/config.toml':
          '[mcp_servers.my-server]\ncommand = "npx"\nargs = ["-y", "@my/server"]\n',
      },
      features: ['mcp'],
    },
  ])('$name', expectScope);
});
