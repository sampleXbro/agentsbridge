import { describe, expect, it } from 'vitest';
import { join, normalize } from 'node:path';
import { buildArtifactPathMap } from '../../../src/core/reference/output-source-map.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

const ROOT = '/proj';

function config(): ValidatedConfig {
  return {
    version: 1,
    targets: ['claude-code'],
    features: ['skills'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

function packSkill(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [
      {
        source: join(ROOT, '.agentsmesh/packs/my-pack/skills/code-review/SKILL.md'),
        name: 'code-review',
        description: 'Code review',
        body: '',
        supportingFiles: [
          {
            relativePath: 'reference/react.md',
            absolutePath: join(
              ROOT,
              '.agentsmesh/packs/my-pack/skills/code-review/reference/react.md',
            ),
            content: '# React',
          },
          {
            relativePath: 'assets/template.md',
            absolutePath: join(
              ROOT,
              '.agentsmesh/packs/my-pack/skills/code-review/assets/template.md',
            ),
            content: '# Template',
          },
        ],
      },
    ],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('buildArtifactPathMap with pack skills', () => {
  it('maps pack skill paths to target paths alongside canonical paths', () => {
    const map = buildArtifactPathMap('claude-code', packSkill(), config(), ROOT);

    const canonicalSkill = normalize(join(ROOT, '.agentsmesh/skills/code-review/SKILL.md'));
    const packSkillPath = normalize(
      join(ROOT, '.agentsmesh/packs/my-pack/skills/code-review/SKILL.md'),
    );
    const targetSkill = normalize(join(ROOT, '.claude/skills/code-review/SKILL.md'));

    expect(map.get(canonicalSkill)).toBe(targetSkill);
    expect(map.get(packSkillPath)).toBe(targetSkill);
  });

  it('maps pack supporting file paths to target paths', () => {
    const map = buildArtifactPathMap('claude-code', packSkill(), config(), ROOT);

    const packRef = normalize(
      join(ROOT, '.agentsmesh/packs/my-pack/skills/code-review/reference/react.md'),
    );
    const targetRef = normalize(join(ROOT, '.claude/skills/code-review/reference/react.md'));

    expect(map.get(packRef)).toBe(targetRef);

    const packAsset = normalize(
      join(ROOT, '.agentsmesh/packs/my-pack/skills/code-review/assets/template.md'),
    );
    const targetAsset = normalize(join(ROOT, '.claude/skills/code-review/assets/template.md'));

    expect(map.get(packAsset)).toBe(targetAsset);
  });

  it('maps pack skill directory paths to target directory paths', () => {
    const map = buildArtifactPathMap('claude-code', packSkill(), config(), ROOT);

    const packDir = normalize(join(ROOT, '.agentsmesh/packs/my-pack/skills/code-review'));
    const targetDir = normalize(join(ROOT, '.claude/skills/code-review'));

    expect(map.get(packDir)).toBe(targetDir);
    expect(map.get(`${packDir}/`)).toBe(`${targetDir}/`);
  });

  it('maps pack supporting subdirectories (e.g. reference/, assets/) with trailing slash', () => {
    const map = buildArtifactPathMap('claude-code', packSkill(), config(), ROOT);

    const packRefDir = normalize(
      join(ROOT, '.agentsmesh/packs/my-pack/skills/code-review/reference'),
    );
    const targetRefDir = normalize(join(ROOT, '.claude/skills/code-review/reference'));
    expect(map.get(packRefDir)).toBe(targetRefDir);
    expect(map.get(`${packRefDir}/`)).toBe(`${targetRefDir}/`);

    const packAssetsDir = normalize(
      join(ROOT, '.agentsmesh/packs/my-pack/skills/code-review/assets'),
    );
    const targetAssetsDir = normalize(join(ROOT, '.claude/skills/code-review/assets'));
    expect(map.get(packAssetsDir)).toBe(targetAssetsDir);
    expect(map.get(`${packAssetsDir}/`)).toBe(`${targetAssetsDir}/`);
  });
});
