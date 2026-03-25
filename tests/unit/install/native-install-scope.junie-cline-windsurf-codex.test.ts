import { describe, it } from 'vitest';
import { expectScope } from './native-install-scope.helpers.js';

describe('stageNativeInstallScope Junie, Cline, and Windsurf', () => {
  it.each([
    {
      name: 'junie-root',
      target: 'junie',
      path: '.junie/guidelines.md',
      files: { '.junie/guidelines.md': '# Junie Root\n' },
      features: ['rules'],
      pick: { rules: ['_root'] },
    },
    {
      name: 'junie-rules-folder',
      target: 'junie',
      path: '.junie/rules',
      files: {
        '.junie/rules/review.md': '---\ndescription: Review\n---\n\nReview code.\n',
      },
      features: ['rules'],
      pick: { rules: ['review'] },
    },
    {
      name: 'junie-commands-folder',
      target: 'junie',
      path: '.junie/commands',
      files: {
        '.junie/commands/review.md': '---\ndescription: Review\n---\n\nRun review.\n',
      },
      features: ['commands'],
      pick: { commands: ['review'] },
    },
    {
      name: 'junie-agents-folder',
      target: 'junie',
      path: '.junie/agents',
      files: {
        '.junie/agents/security-reviewer.md':
          '---\ndescription: Security reviewer\ntools:\n  - Read\nmodel: gpt-5\n---\n\nReview auth.\n',
      },
      features: ['agents'],
      pick: { agents: ['security-reviewer'] },
    },
    {
      name: 'junie-skills-folder',
      target: 'junie',
      path: '.junie/skills/demo',
      files: {
        '.junie/skills/demo/SKILL.md': '---\ndescription: Demo\n---\n\nUse demo.\n',
      },
      features: ['skills'],
      pick: { skills: ['demo'] },
    },
    {
      name: 'junie-mcp-file',
      target: 'junie',
      path: '.junie/mcp/mcp.json',
      files: {
        '.junie/mcp/mcp.json': JSON.stringify({
          mcpServers: { context7: { command: 'npx', args: ['-y', '@ctx/mcp'] } },
        }),
      },
      features: ['mcp'],
    },
    {
      name: 'junie-ignore-file',
      target: 'junie',
      path: '.aiignore',
      files: { '.aiignore': '.env\n' },
      features: ['ignore'],
    },
    {
      name: 'cline-flat-root',
      target: 'cline',
      path: '.clinerules',
      files: { '.clinerules': '# Cline Root\n' },
      features: ['rules'],
      pick: { rules: ['_root'] },
    },
    {
      name: 'cline-workflows-folder',
      target: 'cline',
      path: '.clinerules/workflows',
      files: {
        '.clinerules/_root.md': '# Root\n',
        '.clinerules/workflows/deploy.md': '---\ndescription: Deploy\n---\n\nDeploy now.\n',
      },
      features: ['commands'],
      pick: { commands: ['deploy'] },
    },
    {
      name: 'cline-skills-folder',
      target: 'cline',
      path: '.cline/skills/demo',
      files: {
        '.cline/skills/demo/SKILL.md': '---\ndescription: Demo\n---\n\nUse demo.\n',
      },
      features: ['skills'],
      pick: { skills: ['demo'] },
    },
    {
      name: 'cline-mcp-file',
      target: 'cline',
      path: '.cline/mcp_settings.json',
      files: {
        '.cline/mcp_settings.json': JSON.stringify({
          mcpServers: { fs: { command: 'npx', args: ['-y', '@mcp/fs'] } },
        }),
      },
      features: ['mcp'],
    },
    {
      name: 'cline-ignore-file',
      target: 'cline',
      path: '.clineignore',
      files: { '.clineignore': 'dist\n' },
      features: ['ignore'],
    },
    {
      name: 'windsurf-root',
      target: 'windsurf',
      path: '.windsurfrules',
      files: { '.windsurfrules': '# Windsurf Root\n' },
      features: ['rules'],
      pick: { rules: ['_root'] },
    },
    {
      name: 'windsurf-rules-folder',
      target: 'windsurf',
      path: '.windsurf/rules',
      files: {
        '.windsurf/rules/review.md':
          '---\ndescription: Review\nglob: src/**/*.ts\n---\n\nReview code.\n',
      },
      features: ['rules'],
      pick: { rules: ['review'] },
    },
    {
      name: 'windsurf-hooks-file',
      target: 'windsurf',
      path: '.windsurf/hooks.json',
      files: {
        '.windsurf/hooks.json': JSON.stringify({
          hooks: { pre_tool_use: [{ command: 'echo pre', show_output: true }] },
        }),
      },
      features: ['hooks'],
    },
    {
      name: 'windsurf-mcp-file',
      target: 'windsurf',
      path: '.windsurf/mcp_config.example.json',
      files: {
        '.windsurf/mcp_config.example.json': JSON.stringify({
          mcpServers: { context7: { command: 'npx', args: ['-y', '@ctx/mcp'] } },
        }),
      },
      features: ['mcp'],
    },
    {
      name: 'windsurf-ignore-file',
      target: 'windsurf',
      path: '.windsurfignore',
      files: { '.windsurfignore': 'node_modules/\n' },
      features: ['ignore'],
    },
  ])('$name', expectScope);
});
