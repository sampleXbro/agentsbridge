import { describe, it } from 'vitest';
import { expectScope } from './native-install-scope.helpers.js';

describe('stageNativeInstallScope Claude Code and Cursor', () => {
  it.each([
    {
      name: 'claude-root',
      target: 'claude-code',
      path: '.claude/CLAUDE.md',
      files: { '.claude/CLAUDE.md': '# Claude Root\n' },
      features: ['rules'],
      pick: { rules: ['_root'] },
    },
    {
      name: 'claude-rules-folder',
      target: 'claude-code',
      path: '.claude/rules',
      files: {
        '.claude/rules/review.md': '---\ndescription: Review\n---\n\nReview code.\n',
        '.claude/rules/security.md': '---\ndescription: Security\n---\n\nCheck auth.\n',
      },
      features: ['rules'],
      pick: { rules: ['review', 'security'] },
    },
    {
      name: 'claude-commands-folder',
      target: 'claude-code',
      path: '.claude/commands',
      files: {
        '.claude/commands/review.md': '---\ndescription: Review\n---\n\nReview code.\n',
        '.claude/commands/fix.md': '---\ndescription: Fix\n---\n\nFix lint.\n',
      },
      features: ['commands'],
      pick: { commands: ['fix', 'review'] },
    },
    {
      name: 'claude-agent-file',
      target: 'claude-code',
      path: '.claude/agents/reviewer.md',
      files: {
        '.claude/agents/reviewer.md':
          '---\ndescription: Reviewer\ntools:\n  - Read\n---\n\nReview code.\n',
      },
      features: ['agents'],
      pick: { agents: ['reviewer'] },
    },
    {
      name: 'claude-skill-folder',
      target: 'claude-code',
      path: '.claude/skills/demo',
      files: {
        '.claude/skills/demo/SKILL.md': '---\ndescription: Demo\n---\n\nUse demo.\n',
        '.claude/skills/demo/details.md': 'demo details\n',
      },
      features: ['skills'],
      pick: { skills: ['demo'] },
    },
    {
      name: 'claude-settings-file',
      target: 'claude-code',
      path: '.claude/settings.json',
      files: {
        '.claude/settings.json': JSON.stringify({
          mcpServers: { ctx: { command: 'npx', args: ['-y', '@ctx/mcp'] } },
          permissions: { allow: ['Read'], deny: ['Bash(rm:*)'] },
          hooks: {
            PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo ok' }] }],
          },
        }),
      },
      features: ['hooks', 'mcp', 'permissions'],
    },
    {
      name: 'claude-ignore-file',
      target: 'claude-code',
      path: '.claudeignore',
      files: { '.claudeignore': 'node_modules\ndist\n' },
      features: ['ignore'],
    },
    {
      name: 'cursor-root',
      target: 'cursor',
      path: 'AGENTS.md',
      files: { 'AGENTS.md': '# Cursor Root\n' },
      features: ['rules'],
      pick: { rules: ['_root'] },
    },
    {
      name: 'cursor-rules-folder',
      target: 'cursor',
      path: '.cursor/rules',
      files: {
        '.cursor/rules/review.mdc': '---\ndescription: Review\n---\n\nReview code.\n',
      },
      features: ['rules'],
      pick: { rules: ['review'] },
    },
    {
      name: 'cursor-commands-folder',
      target: 'cursor',
      path: '.cursor/commands',
      files: {
        '.cursor/commands/review.md': '---\ndescription: Review\n---\n\nReview code.\n',
        '.cursor/commands/fix.md': '---\ndescription: Fix\n---\n\nFix it.\n',
      },
      features: ['commands'],
      pick: { commands: ['fix', 'review'] },
    },
    {
      name: 'cursor-agent-file',
      target: 'cursor',
      path: '.cursor/agents/reviewer.md',
      files: {
        '.cursor/agents/reviewer.md':
          '---\ndescription: Reviewer\ntools:\n  - Read\n---\n\nReview code.\n',
      },
      features: ['agents'],
      pick: { agents: ['reviewer'] },
    },
    {
      name: 'cursor-skill-file',
      target: 'cursor',
      path: '.cursor/skills/demo.md',
      files: { '.cursor/skills/demo.md': '---\ndescription: Demo\n---\n\nUse demo.\n' },
      features: ['skills'],
      pick: { skills: ['demo'] },
    },
    {
      name: 'cursor-mcp-file',
      target: 'cursor',
      path: '.cursor/mcp.json',
      files: {
        '.cursor/mcp.json': JSON.stringify({
          mcpServers: { fs: { command: 'npx', args: ['-y', '@mcp/fs'] } },
        }),
      },
      features: ['mcp'],
    },
    {
      name: 'cursor-hooks-file',
      target: 'cursor',
      path: '.cursor/hooks.json',
      files: {
        '.cursor/hooks.json': JSON.stringify({
          hooks: {
            PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo ok' }] }],
          },
        }),
      },
      features: ['hooks'],
    },
    {
      name: 'cursor-settings-file',
      target: 'cursor',
      path: '.cursor/settings.json',
      files: {
        '.cursor/settings.json': JSON.stringify({
          permissions: { allow: ['Read'], deny: ['Bash(rm:*)'] },
        }),
      },
      features: ['permissions'],
    },
    {
      name: 'cursor-ignore-file',
      target: 'cursor',
      path: '.cursorignore',
      files: { '.cursorignore': 'coverage\n' },
      features: ['ignore'],
    },
  ])('$name', expectScope);
});
