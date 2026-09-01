/**
 * openhands writes into `.agents/skills/`, `.agents/agents/` and
 * `.agents/plugins/agentsmesh/`, all of which existing targets already fill.
 * `resolveOutputCollisions` hard-fails on two targets writing one path with
 * different bytes, so every shared file must come out identical.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles, GenerateResult } from '../../../../src/core/types.js';
import { generate } from '../../../../src/core/generate/engine.js';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-openhands-shared-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  dir = '';
});

const canonical: CanonicalFiles = {
  rules: [
    {
      source: '.agentsmesh/rules/_root.md',
      root: true,
      targets: [],
      description: 'Standards',
      globs: [],
      body: '# Standards',
    },
    {
      source: '.agentsmesh/rules/typescript.md',
      root: false,
      targets: [],
      description: 'TypeScript rules',
      globs: ['src/**/*.ts'],
      body: '# TypeScript',
    },
  ],
  commands: [
    {
      source: '.agentsmesh/commands/review.md',
      name: 'review',
      description: 'Code review',
      allowedTools: ['Read'],
      body: 'Review it.',
    },
  ],
  agents: [
    {
      source: '.agentsmesh/agents/code-reviewer.md',
      name: 'code-reviewer',
      description: 'Reviewer',
      tools: ['Read'],
      disallowedTools: [],
      model: 'sonnet',
      permissionMode: '',
      maxTurns: 0,
      mcpServers: [],
      hooks: {},
      skills: [],
      memory: '',
      body: 'You review.',
    },
  ],
  skills: [
    {
      source: '.agentsmesh/skills/api-generator/SKILL.md',
      name: 'api-generator',
      description: 'API helper',
      body: 'Generate routes.',
      supportingFiles: [],
    },
  ],
  mcp: { mcpServers: { docs: { type: 'stdio', command: 'npx', args: ['-y', 'docs'], env: {} } } },
  permissions: { allow: ['Read'], deny: [], ask: [] },
  hooks: { PostToolUse: [{ matcher: 'Write', command: 'fmt' }] },
  ignore: ['dist'],
};

function config(targets: string[]): ValidatedConfig {
  return {
    version: 1,
    targets,
    features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'hooks', 'ignore', 'permissions'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

async function generateWith(targets: string[]): Promise<GenerateResult[]> {
  return generate({ config: config(targets), canonical, projectRoot: dir });
}

function contentAt(results: readonly GenerateResult[], path: string): string | undefined {
  return results.find((r) => r.path === path)?.content;
}

describe('openhands alongside the targets that share .agents/', () => {
  it('generates with antigravity, codex-cli and goose all enabled without a collision', async () => {
    await expect(
      generateWith(['openhands', 'antigravity', 'codex-cli', 'goose']),
    ).resolves.toBeDefined();
  });

  it('emits byte-identical .agents/agents/<name>.md as antigravity', async () => {
    const alone = await generateWith(['openhands']);
    const antigravityAlone = await generateWith(['antigravity']);
    const path = '.agents/agents/code-reviewer.md';
    expect(contentAt(alone, path)).toBeDefined();
    expect(contentAt(alone, path)).toBe(contentAt(antigravityAlone, path));
  });

  it('emits byte-identical .agents/skills/<name>/SKILL.md as codex-cli', async () => {
    const alone = await generateWith(['openhands']);
    const codexAlone = await generateWith(['codex-cli']);
    const path = '.agents/skills/api-generator/SKILL.md';
    expect(contentAt(alone, path)).toBeDefined();
    expect(contentAt(alone, path)).toBe(contentAt(codexAlone, path));
  });

  it('emits byte-identical .agents/plugins/agentsmesh/.mcp.json as goose', async () => {
    const alone = await generateWith(['openhands']);
    const gooseAlone = await generateWith(['goose']);
    const path = '.agents/plugins/agentsmesh/.mcp.json';
    expect(contentAt(alone, path)).toBeDefined();
    expect(contentAt(alone, path)).toBe(contentAt(gooseAlone, path));
  });

  it('never writes .agents/hooks.json — OpenHands hooks live under .openhands/', async () => {
    const results = await generateWith(['openhands']);
    expect(results.map((r) => r.path)).toContain('.openhands/hooks.json');
    expect(results.filter((r) => r.target === 'openhands').map((r) => r.path)).not.toContain(
      '.agents/hooks.json',
    );
  });

  it('emits the exact project-scope path set', async () => {
    const results = await generateWith(['openhands']);
    expect(results.map((r) => r.path).sort()).toEqual(
      [
        '.agents/agents/code-reviewer.md',
        '.agents/plugins/agentsmesh/.mcp.json',
        '.agents/plugins/agentsmesh/commands/review.md',
        '.agents/skills/api-generator/SKILL.md',
        '.agents/skills/typescript.md',
        'AGENTS.md',
        '.openhands/hooks.json',
      ].sort(),
    );
  });

  it('emits the exact global-scope path set', async () => {
    const results = await generate({
      config: config(['openhands']),
      canonical,
      projectRoot: dir,
      scope: 'global',
    });
    expect(results.map((r) => r.path).sort()).toEqual(
      [
        '.agents/agents/code-reviewer.md',
        '.agents/plugins/agentsmesh/.mcp.json',
        '.agents/plugins/agentsmesh/commands/review.md',
        '.agents/skills/_root.md',
        '.agents/skills/api-generator/SKILL.md',
        '.agents/skills/typescript.md',
        '.openhands/hooks.json',
      ].sort(),
    );
  });
});
