import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  AIDER_CONVENTIONS,
  AIDER_CONF_FILE,
  AIDER_IGNORE,
  AIDER_GLOBAL_CONVENTIONS,
  AIDER_GLOBAL_IGNORE,
  AIDER_SKILLS_DIR,
  AIDER_GLOBAL_SKILLS_DIR,
} from '../../../../src/targets/aider/constants.js';

describe('aider global layout', () => {
  const descriptor = getBuiltinTargetDefinition('aider')!;

  it('descriptor.globalSupport exists', () => {
    expect(descriptor.globalSupport).toBeDefined();
  });

  it('globalSupport has layout with rewriteGeneratedPath', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath).toBeDefined();
  });

  it('rewriteGeneratedPath transforms CONVENTIONS.md to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(AIDER_CONVENTIONS, '')).toBe(AIDER_GLOBAL_CONVENTIONS);
  });

  it('rewriteGeneratedPath transforms .aiderignore to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(AIDER_IGNORE, '')).toBe(AIDER_GLOBAL_IGNORE);
  });

  it('rewriteGeneratedPath transforms .aider/skills/ to global path', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    const skillPath = `${AIDER_SKILLS_DIR}/debugging/SKILL.md`;
    const expectedPath = `${AIDER_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`;
    expect(rewrite(skillPath, '')).toBe(expectedPath);
  });

  it('rewriteGeneratedPath passes through unknown paths unchanged', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite('some/unknown/path.txt', '')).toBe('some/unknown/path.txt');
  });

  it('rewriteGeneratedPath keeps .aider.conf.yml so hook keys reach ~/.aider.conf.yml', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(AIDER_CONF_FILE, '')).toBe(AIDER_CONF_FILE);
  });

  it('does not manage .aider.conf.yml for stale cleanup in either scope', () => {
    expect(descriptor.project.managedOutputs!.files).not.toContain(AIDER_CONF_FILE);
    expect(descriptor.globalSupport!.layout.managedOutputs!.files).not.toContain(AIDER_CONF_FILE);
  });

  it('mergeGeneratedOutputContent unions read: and preserves existing keys', () => {
    const merge = descriptor.mergeGeneratedOutputContent!;
    const existing = 'model: gpt-4o\nread:\n  - PROJECT.md\n';
    const merged = merge(existing, undefined, 'read:\n  - CONVENTIONS.md\n', AIDER_CONF_FILE);
    const parsed = parseYaml(merged!) as { model?: string; read?: string[] };
    expect(parsed.model).toBe('gpt-4o');
    expect(parsed.read).toEqual(['PROJECT.md', 'CONVENTIONS.md']);
  });

  it('mergeGeneratedOutputContent ignores non-conf paths', () => {
    const merge = descriptor.mergeGeneratedOutputContent!;
    expect(merge('x', undefined, 'y', AIDER_CONVENTIONS)).toBeNull();
  });

  it('globalSupport.capabilities matches project capabilities', () => {
    expect(descriptor.globalSupport!.capabilities).toEqual(descriptor.capabilities);
  });

  it('globalSupport has detection paths', () => {
    expect(descriptor.globalSupport!.detectionPaths.length).toBeGreaterThan(0);
    expect(descriptor.globalSupport!.detectionPaths).toContain(AIDER_GLOBAL_CONVENTIONS);
  });
});

describe('aider global frontmatter preservation', () => {
  const TEST_DIR = join(tmpdir(), 'am-aider-global-fm');

  function makeGlobalConfig(): ValidatedConfig {
    return {
      version: 1,
      targets: ['aider'],
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

  it('preserves embedded skill frontmatter in global mode', async () => {
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
      (r) => r.target === 'aider' && r.path === `${AIDER_GLOBAL_SKILLS_DIR}/debugging/SKILL.md`,
    );
    expect(skill).toBeDefined();
    expect(skill!.content).toContain('name: debugging');
    expect(skill!.content).toContain('description: Debug workflow');
    expect(skill!.content).toContain('# Debugging');
  });

  it('preserves rule body content in global mode', async () => {
    const results = await generate({
      config: makeGlobalConfig(),
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: '',
            globs: [],
            body: 'Use TDD and strict TypeScript.',
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const rule = results.find((r) => r.target === 'aider' && r.path === AIDER_GLOBAL_CONVENTIONS);
    expect(rule).toBeDefined();
    expect(rule!.content).toContain('Use TDD and strict TypeScript.');
    // The conf wiring is project-only — it must NOT appear in global mode.
    expect(results.find((r) => r.target === 'aider' && r.path === AIDER_CONF_FILE)).toBeUndefined();
  });

  it('writes hook keys to ~/.aider.conf.yml in global mode without the read: wiring', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['rules', 'hooks'] } as ValidatedConfig,
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: '',
            globs: [],
            body: 'Use TDD.',
          },
        ],
        hooks: { PostToolUse: [{ matcher: 'Write|Edit', command: 'ruff check' }] },
      }),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const conf = results.find((r) => r.target === 'aider' && r.path === AIDER_CONF_FILE);
    expect(conf).toBeDefined();
    const parsed = parseYaml(conf!.content) as Record<string, unknown>;
    expect(parsed['lint-cmd']).toEqual(['ruff check']);
    expect(parsed['auto-lint']).toBe(true);
    expect(parsed.read).toBeUndefined();
  });

  it('emits .aider.conf.yml wiring CONVENTIONS.md in project mode', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['rules'] } as ValidatedConfig,
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: '',
            globs: [],
            body: 'Use TDD.',
          },
        ],
      }),
      projectRoot: TEST_DIR,
      scope: 'project',
    });

    const conf = results.find((r) => r.target === 'aider' && r.path === AIDER_CONF_FILE);
    expect(conf).toBeDefined();
    const parsed = parseYaml(conf!.content) as { read?: string[] };
    expect(parsed.read).toEqual(['CONVENTIONS.md']);
  });

  it('keeps the read: wiring when hooks write the same conf file in one pass', async () => {
    const results = await generate({
      config: { ...makeGlobalConfig(), features: ['rules', 'hooks'] } as ValidatedConfig,
      canonical: makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: '',
            globs: [],
            body: 'Use TDD.',
          },
        ],
        hooks: { Notification: [{ matcher: '*', command: 'notify-send aider' }] },
      }),
      projectRoot: TEST_DIR,
      scope: 'project',
    });

    const confs = results.filter((r) => r.target === 'aider' && r.path === AIDER_CONF_FILE);
    expect(confs).toHaveLength(1);
    const parsed = parseYaml(confs[0].content) as Record<string, unknown>;
    expect(parsed.read).toEqual(['CONVENTIONS.md']);
    expect(parsed['notifications-command']).toBe('notify-send aider');
  });
});
