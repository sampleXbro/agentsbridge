import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

describe('cursor global layout — paths', () => {
  const layout = getTargetLayout('cursor', 'global')!;

  it('resolves rule path to .cursor/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.cursor/rules/typescript.mdc');
  });

  it('resolves command path to .cursor/commands/', () => {
    expect(layout.paths.commandPath('review', {} as never)).toBe('.cursor/commands/review.md');
  });

  it('resolves agent path to .cursor/agents/', () => {
    expect(layout.paths.agentPath('reviewer', {} as never)).toBe('.cursor/agents/reviewer.md');
  });
});

describe('cursor global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('cursor', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('suppresses AGENTS.md (returns null)', () => {
    expect(rewrite('AGENTS.md')).toBeNull();
  });

  it('keeps .cursor/AGENTS.md unchanged', () => {
    expect(rewrite('.cursor/AGENTS.md')).toBe('.cursor/AGENTS.md');
  });

  it('keeps .cursor/rules/general.mdc unchanged', () => {
    expect(rewrite('.cursor/rules/general.mdc')).toBe('.cursor/rules/general.mdc');
  });

  it('keeps .cursor/rules/*.mdc unchanged', () => {
    expect(rewrite('.cursor/rules/typescript.mdc')).toBe('.cursor/rules/typescript.mdc');
  });

  it('keeps .cursor/commands/ paths unchanged', () => {
    expect(rewrite('.cursor/commands/review.md')).toBe('.cursor/commands/review.md');
  });

  it('keeps .cursor/agents/ paths unchanged', () => {
    expect(rewrite('.cursor/agents/reviewer.md')).toBe('.cursor/agents/reviewer.md');
  });

  it('keeps .cursor/skills/ paths unchanged', () => {
    expect(rewrite('.cursor/skills/ts-pro/SKILL.md')).toBe('.cursor/skills/ts-pro/SKILL.md');
  });

  it('keeps .cursor/mcp.json unchanged', () => {
    expect(rewrite('.cursor/mcp.json')).toBe('.cursor/mcp.json');
  });

  it('keeps .cursor/hooks.json unchanged', () => {
    expect(rewrite('.cursor/hooks.json')).toBe('.cursor/hooks.json');
  });

  it('keeps .cursorignore unchanged', () => {
    expect(rewrite('.cursorignore')).toBe('.cursorignore');
  });

  it('suppresses .cursor/settings.json (not in global mode)', () => {
    expect(rewrite('.cursor/settings.json')).toBeNull();
  });
});

describe('cursor global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('cursor', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .cursor/skills/ to .agents/skills/', () => {
    expect(mirror('.cursor/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .cursor/skills/', () => {
    expect(mirror('.cursor/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.cursor/skills/ts-pro/SKILL.md', ['codex-cli'])).toBeNull();
  });

  it('returns null for rule files (not mirrored)', () => {
    expect(mirror('.cursor/rules/typescript.mdc', [])).toBeNull();
  });

  it('returns null for command files (not mirrored)', () => {
    expect(mirror('.cursor/commands/review.md', [])).toBeNull();
  });

  it('returns null for agent files (not mirrored)', () => {
    expect(mirror('.cursor/agents/reviewer.md', [])).toBeNull();
  });

  it('returns null for MCP file (not mirrored)', () => {
    expect(mirror('.cursor/mcp.json', [])).toBeNull();
  });

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror('.cursor/AGENTS.md', [])).toBeNull();
  });
});

describe('cursor global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-cursor-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['cursor'],
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
      (r) => r.target === 'cursor' && r.path === '.cursor/skills/debugging/SKILL.md',
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

    const rule = results.find((r) => r.target === 'cursor' && r.path === '.cursor/rules/ts.mdc');
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('description: TypeScript standards');
    expect(rule!.content).toContain('src/**/*.ts');
    expect(rule!.content).toContain('alwaysApply: false');
    expect(rule!.content).toContain('Use strict mode.');
  });
});
