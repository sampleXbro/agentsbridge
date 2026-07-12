import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

describe('cline global layout — paths', () => {
  const layout = getTargetLayout('cline', 'global')!;

  it('resolves rule path to .cline/data/settings/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.cline/data/settings/rules/typescript.md');
  });

  it('resolves command path to Documents/Cline/Workflows/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      'Documents/Cline/Workflows/deploy.md',
    );
  });

  it('resolves agent path to null (no per-name destination; no global agents surface)', () => {
    expect(
      layout.paths.agentPath('my-agent', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
        conversions: { agents_to_skills: { cline: true } },
      }),
    ).toBeNull();
  });
});

describe('cline global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('cline', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('suppresses AGENTS.md in global mode (returns null)', () => {
    expect(rewrite('AGENTS.md')).toBeNull();
  });

  it('rewrites .clinerules/workflows/ to Documents/Cline/Workflows/', () => {
    expect(rewrite('.clinerules/workflows/deploy.md')).toBe('Documents/Cline/Workflows/deploy.md');
  });

  it('rewrites .cline/rules/ to .cline/data/settings/rules/', () => {
    expect(rewrite('.cline/rules/typescript.md')).toBe('.cline/data/settings/rules/typescript.md');
  });

  it('rewrites .cline/skills/ to .cline/data/settings/skills/', () => {
    expect(rewrite('.cline/skills/ts-pro/SKILL.md')).toBe(
      '.cline/data/settings/skills/ts-pro/SKILL.md',
    );
  });

  it('keeps .cline/hooks/ unchanged (same relative path in both scopes)', () => {
    expect(rewrite('.cline/hooks/pretooluse-0.sh')).toBe('.cline/hooks/pretooluse-0.sh');
  });
});

describe('cline global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('cline', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .cline/data/settings/skills/ to .agents/skills/', () => {
    expect(mirror('.cline/data/settings/skills/ts-pro/SKILL.md', [])).toBe(
      '.agents/skills/ts-pro/SKILL.md',
    );
  });

  it('mirrors nested supporting file under .cline/data/settings/skills/', () => {
    expect(mirror('.cline/data/settings/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror('AGENTS.md', [])).toBeNull();
  });

  it('returns null for workflow files (not mirrored)', () => {
    expect(mirror('Documents/Cline/Workflows/commit.md', [])).toBeNull();
  });
});

describe('cline global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-cline-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['cline'],
      features: ['rules', 'skills'],
      extends: [],
      overrides: {},
      collaboration: { strategy: 'merge', lock_features: [] },
    } as ValidatedConfig;
  }

  function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
    return {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
      ...overrides,
    };
  }

  it('preserves skill frontmatter in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        skills: [
          {
            source: '/proj/.agentsmesh/skills/debugging/SKILL.md',
            name: 'debugging',
            description: 'Debug workflow',
            body: '# Debugging\n\nReproduce first.',
            supportingFiles: [],
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const skill = results.find(
      (r) => r.target === 'cline' && r.path === '.cline/data/settings/skills/debugging/SKILL.md',
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });

  it('preserves rule frontmatter in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/ts.md',
            root: false,
            targets: [],
            description: 'TypeScript standards',
            globs: ['src/**/*.ts'],
            body: 'Use strict mode.',
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const rule = results.find(
      (r) => r.target === 'cline' && r.path === '.cline/data/settings/rules/ts.md',
    );
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('description: TypeScript standards');
    expect(rule!.content).toContain('src/**/*.ts');
    expect(rule!.content).toContain('Use strict mode.');
  });

  it('does not generate MCP in global mode (no documented global MCP surface)', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['mcp'] } as ValidatedConfig,
      canonical: makeCanonical({
        mcp: {
          mcpServers: {
            'test-server': { type: 'stdio', command: 'npx', args: ['-y', '@test/mcp'], env: {} },
          },
        },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const mcpFile = results.find((r) => r.target === 'cline' && r.path.includes('mcp'));
    expect(mcpFile).toBeUndefined();
  });

  it('preserves hooks configuration in global mode', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['hooks'] } as ValidatedConfig,
      canonical: makeCanonical({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              type: 'command' as const,
              command: './scripts/validate.sh',
              timeout: 30,
            },
          ],
        },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    // Cline hooks resolve to the same relative path (.cline/hooks/) in both scopes.
    const hookFile = results.find(
      (r) => r.target === 'cline' && r.path === '.cline/hooks/pretooluse-0.sh',
    );
    expect(hookFile).toBeDefined();
    expect(hookFile!.content).toContain('#!/usr/bin/env bash');
    expect(hookFile!.content).toContain('./scripts/validate.sh');
    expect(hookFile!.content).toContain('agentsmesh-event: PreToolUse');
    expect(hookFile!.content).toContain('agentsmesh-matcher: Bash');
  });

  it('does not generate agents.yaml in global mode (no documented global agents surface)', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['agents'] } as ValidatedConfig,
      canonical: makeCanonical({
        agents: [
          {
            source: '/proj/.agentsmesh/agents/reviewer.md',
            name: 'reviewer',
            description: '',
            tools: [],
            disallowedTools: [],
            model: '',
            permissionMode: '',
            maxTurns: 0,
            mcpServers: [],
            hooks: {},
            skills: [],
            memory: '',
            body: 'Body.',
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const agentsFile = results.find((r) => r.target === 'cline' && r.path.includes('agents'));
    expect(agentsFile).toBeUndefined();
  });

  it('does not generate .clineignore in global mode (no documented global ignore surface)', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['ignore'] } as ValidatedConfig,
      canonical: makeCanonical({ ignore: ['node_modules/'] }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const ignoreFile = results.find((r) => r.target === 'cline' && r.path.includes('ignore'));
    expect(ignoreFile).toBeUndefined();
  });
});
