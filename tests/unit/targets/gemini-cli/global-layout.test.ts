import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

describe('gemini-cli global layout — paths', () => {
  const layout = getTargetLayout('gemini-cli', 'global')!;

  it('resolves rule path to .gemini/GEMINI.md (aggregate)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.gemini/GEMINI.md');
  });

  it('resolves command path to .gemini/commands/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe('.gemini/commands/deploy.toml');
  });

  it('resolves namespaced command path', () => {
    expect(layout.paths.commandPath('tools:deploy', {} as never)).toBe(
      '.gemini/commands/tools/deploy.toml',
    );
  });

  it('resolves agent path to .gemini/agents/', () => {
    expect(
      layout.paths.agentPath('reviewer', {
        features: [],
        targets: [],
        version: 1,
        extends: [],
        overrides: {},
        collaboration: { strategy: 'merge', lock_features: [] },
      }),
    ).toBe('.gemini/agents/reviewer.md');
  });
});

describe('gemini-cli global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('gemini-cli', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites GEMINI.md to .gemini/GEMINI.md', () => {
    expect(rewrite('GEMINI.md')).toBe('.gemini/GEMINI.md');
  });

  it('rewrites AGENTS.md to .gemini/AGENTS.md', () => {
    expect(rewrite('AGENTS.md')).toBe('.gemini/AGENTS.md');
  });

  it('rewrites .gemini/settings.json unchanged (identity)', () => {
    expect(rewrite('.gemini/settings.json')).toBe('.gemini/settings.json');
  });

  it('keeps .gemini/commands/ paths unchanged', () => {
    expect(rewrite('.gemini/commands/deploy.toml')).toBe('.gemini/commands/deploy.toml');
  });

  it('keeps .gemini/skills/ paths unchanged', () => {
    expect(rewrite('.gemini/skills/ts-pro/SKILL.md')).toBe('.gemini/skills/ts-pro/SKILL.md');
  });

  it('keeps .gemini/agents/ paths unchanged', () => {
    expect(rewrite('.gemini/agents/reviewer.md')).toBe('.gemini/agents/reviewer.md');
  });

  it('suppresses .gemini/policies/ in global mode (returns null)', () => {
    expect(rewrite('.gemini/policies/permissions.toml')).toBeNull();
  });

  it('suppresses .geminiignore in global mode (returns null)', () => {
    expect(rewrite('.geminiignore')).toBeNull();
  });

  it('returns unchanged path for unrecognized paths', () => {
    expect(rewrite('.gemini/other/file.md')).toBe('.gemini/other/file.md');
  });
});

describe('gemini-cli global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('gemini-cli', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .gemini/skills/ to .agents/skills/', () => {
    expect(mirror('.gemini/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .gemini/skills/', () => {
    expect(mirror('.gemini/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.gemini/skills/ts-pro/SKILL.md', ['codex-cli'])).toBeNull();
  });

  it('returns null for GEMINI.md (not mirrored)', () => {
    expect(mirror('.gemini/GEMINI.md', [])).toBeNull();
  });

  it('returns null for AGENTS.md (not mirrored)', () => {
    expect(mirror('.gemini/AGENTS.md', [])).toBeNull();
  });

  it('returns null for command files (not mirrored)', () => {
    expect(mirror('.gemini/commands/deploy.toml', [])).toBeNull();
  });

  it('returns null for agent files (not mirrored)', () => {
    expect(mirror('.gemini/agents/reviewer.md', [])).toBeNull();
  });
});

describe('gemini-cli project layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('gemini-cli', 'project')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .gemini/skills/ to .agents/skills/', () => {
    expect(mirror('.gemini/skills/api-generator/SKILL.md', [])).toBe(
      '.agents/skills/api-generator/SKILL.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.gemini/skills/api-generator/SKILL.md', ['codex-cli'])).toBeNull();
  });
});

describe('gemini-cli global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-gemini-cli-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['gemini-cli'],
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
      (r) => r.target === 'gemini-cli' && r.path === '.gemini/skills/debugging/SKILL.md',
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });

  it('embeds rule content in root GEMINI.md in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: 'Root rule',
            globs: [],
            body: '# Root\nUse TypeScript.',
          },
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

    // Gemini-CLI embeds all rules into GEMINI.md (no separate non-root rule files)
    const rootFile = results.find(
      (r) => r.target === 'gemini-cli' && r.path === '.gemini/GEMINI.md',
    );
    expect(rootFile).toBeDefined();
    expect(rootFile!.content).toContain('TypeScript standards');
    expect(rootFile!.content).toContain('Use strict mode.');
  });
});
