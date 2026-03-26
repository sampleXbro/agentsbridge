import { describe, it } from 'vitest';
import { expectScope } from './native-install-scope.helpers.js';

describe('stageNativeInstallScope Copilot, Continue, and Gemini CLI', () => {
  it.each([
    {
      name: 'copilot-root',
      target: 'copilot',
      path: '.github/copilot-instructions.md',
      files: { '.github/copilot-instructions.md': '# Copilot Root\n' },
      features: ['rules'],
      pick: { rules: ['_root'] },
    },
    {
      name: 'copilot-instructions-folder',
      target: 'copilot',
      path: '.github/instructions',
      files: {
        '.github/instructions/review.instructions.md':
          '---\ndescription: Review\napplyTo: src/**/*.ts\n---\n\nReview TS.\n',
        '.github/instructions/test.instructions.md':
          '---\ndescription: Test\napplyTo: tests/**/*.ts\n---\n\nWrite tests.\n',
      },
      features: ['rules'],
      pick: { rules: ['review', 'test'] },
    },
    {
      name: 'copilot-prompts-folder',
      target: 'copilot',
      path: '.github/prompts',
      files: {
        '.github/prompts/review.prompt.md': [
          '---',
          'description: Review prompt',
          'x-agentsmesh-kind: command',
          'x-agentsmesh-name: review',
          '---',
          '',
          'Review the diff.',
        ].join('\n'),
      },
      features: ['commands'],
      pick: { commands: ['review'] },
    },
    {
      name: 'copilot-skill-folder',
      target: 'copilot',
      path: '.github/skills/demo',
      files: {
        '.github/skills/demo/SKILL.md': '---\ndescription: Demo\n---\n\nUse demo.\n',
        '.github/skills/demo/examples.md': 'examples\n',
      },
      features: ['skills'],
      pick: { skills: ['demo'] },
    },
    {
      name: 'copilot-agent-file',
      target: 'copilot',
      path: '.github/agents/reviewer.agent.md',
      files: {
        '.github/agents/reviewer.agent.md':
          '---\ndescription: Reviewer\ntools:\n  - Read\n---\n\nReview code.\n',
      },
      features: ['agents'],
      pick: { agents: ['reviewer'] },
    },
    {
      name: 'copilot-hooks-folder',
      target: 'copilot',
      path: '.github/hooks',
      files: {
        '.github/hooks/agentsmesh.json': JSON.stringify({
          hooks: { preToolUse: [{ bash: './pre.sh', comment: 'Matcher: src/**/*.ts' }] },
        }),
        '.github/hooks/pre.sh': '#!/bin/sh\n# agentsmesh-command: pnpm lint\n',
      },
      features: ['hooks'],
    },
    {
      name: 'continue-rules-folder',
      target: 'continue',
      path: '.continue/rules',
      files: { '.continue/rules/_root.md': '---\nname: Root\n---\n\nUse TS.\n' },
      features: ['rules'],
      pick: { rules: ['_root'] },
    },
    {
      name: 'continue-prompts-folder',
      target: 'continue',
      path: '.continue/prompts',
      files: {
        '.continue/prompts/review.md':
          '---\ndescription: Review\nx-agentsmesh-kind: command\nx-agentsmesh-name: review\n---\n\nReview.\n',
      },
      features: ['commands'],
      pick: { commands: ['review'] },
    },
    {
      name: 'continue-skill-folder',
      target: 'continue',
      path: '.continue/skills/demo',
      files: {
        '.continue/skills/demo/SKILL.md': '---\ndescription: Demo\n---\n\nUse demo.\n',
        '.continue/skills/demo/notes.md': 'notes\n',
      },
      features: ['skills'],
      pick: { skills: ['demo'] },
    },
    {
      name: 'continue-mcp-folder',
      target: 'continue',
      path: '.continue/mcpServers',
      files: {
        '.continue/mcpServers/servers.json': JSON.stringify({
          mcpServers: { context7: { command: 'npx', args: ['-y', '@ctx/mcp'] } },
        }),
      },
      features: ['mcp'],
    },
    {
      name: 'gemini-root',
      target: 'gemini-cli',
      path: 'GEMINI.md',
      files: { 'GEMINI.md': '# Gemini Root\n' },
      features: ['rules'],
      pick: { rules: ['_root'] },
    },
    {
      name: 'gemini-command-file',
      target: 'gemini-cli',
      path: '.gemini/commands/git/commit.toml',
      files: {
        '.gemini/commands/git/commit.toml':
          'description = "Commit"\nprompt = "Commit staged changes"\n',
      },
      features: ['commands'],
      pick: { commands: ['git:commit'] },
    },
    {
      name: 'gemini-skill-folder',
      target: 'gemini-cli',
      path: '.gemini/skills/demo',
      files: {
        '.gemini/skills/demo/SKILL.md': '---\ndescription: Demo\n---\n\nUse demo.\n',
        '.gemini/skills/demo/guide.md': 'guide\n',
      },
      features: ['skills'],
      pick: { skills: ['demo'] },
    },
    {
      name: 'gemini-agent-file',
      target: 'gemini-cli',
      path: '.gemini/agents/reviewer.md',
      files: {
        '.gemini/agents/reviewer.md':
          '---\nname: reviewer\ndescription: Reviewer\ntools:\n  - Read\nmodel: gemini-2.5-pro\n---\n\nReview code.\n',
      },
      features: ['agents'],
      pick: { agents: ['reviewer'] },
    },
    {
      name: 'gemini-settings-file',
      target: 'gemini-cli',
      path: '.gemini/settings.json',
      files: {
        '.gemini/settings.json': JSON.stringify({
          mcpServers: { fs: { command: 'npx', args: ['-y', '@mcp/fs'] } },
          ignorePatterns: ['node_modules'],
          hooks: { postToolUse: [{ matcher: 'Write', command: 'prettier --write .' }] },
        }),
      },
      features: ['hooks', 'ignore', 'mcp'],
    },
    {
      name: 'gemini-policies-folder',
      target: 'gemini-cli',
      path: '.gemini/policies',
      files: {
        '.gemini/policies/permissions.toml':
          '[[rule]]\ntoolName = "read_file"\ndecision = "allow"\n',
      },
      features: ['permissions'],
    },
  ])('$name', expectScope);
});
