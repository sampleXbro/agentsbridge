import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync } from 'node:fs';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

const ALL_FEATURES = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'permissions',
  'hooks',
  'ignore',
];

function makeConfig(): ValidatedConfig {
  return {
    version: 1,
    targets: ['warp'],
    features: ALL_FEATURES,
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as unknown as ValidatedConfig;
}

function makeCanonical(): CanonicalFiles {
  return {
    rules: [
      {
        source: 'rules/_root.md',
        root: true,
        targets: [],
        description: 'root',
        globs: [],
        body: '# Root\n\nAlways run tests.',
      },
      {
        source: 'rules/typescript.md',
        root: false,
        targets: [],
        description: 'TypeScript standards',
        globs: [],
        body: '# TypeScript\n\nUse strict mode.',
      },
    ],
    commands: [
      {
        source: 'commands/review.md',
        name: 'review',
        description: 'Review',
        allowedTools: [],
        body: 'Review it.',
      },
    ],
    agents: [
      {
        source: 'agents/tester.md',
        name: 'tester',
        description: 'Tester',
        tools: [],
        disallowedTools: [],
        model: '',
        permissionMode: '',
        maxTurns: 0,
        mcpServers: [],
        hooks: {},
        skills: [],
        memory: '',
        body: 'Test it.',
      },
    ],
    skills: [
      {
        source: '/proj/.agentsmesh/skills/debugging/SKILL.md',
        name: 'debugging',
        description: 'Debug workflow',
        body: '# Debugging',
        supportingFiles: [],
      },
    ],
    mcp: {
      mcpServers: {
        context7: { type: 'stdio', command: 'npx', args: ['-y', 'context7'], env: {} },
      },
    },
    permissions: { allow: ['Bash(git status:*)'], deny: [], ask: [] },
    hooks: { preCommit: [{ command: 'pnpm lint' }] },
    ignore: ['node_modules/', '*.log'],
  } as unknown as CanonicalFiles;
}

function tempRoot(label: string): string {
  const root = join(tmpdir(), `warp-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  return root;
}

async function generatedPaths(scope: 'project' | 'global'): Promise<string[]> {
  const root = tempRoot(`surface-${scope}`);
  const results = await generate({
    config: makeConfig(),
    canonical: makeCanonical(),
    projectRoot: root,
    scope,
  });
  rmSync(root, { recursive: true, force: true });
  expect(results.every((r) => r.target === 'warp')).toBe(true);
  return results.map((r) => r.path).sort();
}

describe('warp generated surface', () => {
  it('emits exactly the project-scope artifact set', async () => {
    expect(await generatedPaths('project')).toEqual([
      '.warp/.mcp.json',
      '.warp/skills/am-agent-tester/SKILL.md',
      '.warp/skills/am-command-review/SKILL.md',
      '.warp/skills/debugging/SKILL.md',
      '.warpindexingignore',
      'AGENTS.md',
    ]);
  });

  // `.agents/skills/` entries are the pre-existing cross-tool skill mirror
  // (`mirrorSkillsToAgents`), not a second skill generator.
  it('emits exactly the global-scope artifact set', async () => {
    expect(await generatedPaths('global')).toEqual([
      '.agents/AGENTS.md',
      '.agents/skills/am-agent-tester/SKILL.md',
      '.agents/skills/am-command-review/SKILL.md',
      '.agents/skills/debugging/SKILL.md',
      '.warp/.mcp.json',
      '.warp/settings.toml',
      '.warp/skills/am-agent-tester/SKILL.md',
      '.warp/skills/am-command-review/SKILL.md',
      '.warp/skills/debugging/SKILL.md',
    ]);
  });
});
