import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { generate } from '../../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

const TEST_DIR = join(tmpdir(), 'am-engine-global-file-reference-rewrite');

function config(): ValidatedConfig {
  return {
    version: 1,
    targets: ['claude-code'],
    features: ['rules', 'skills'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

function canonical(): CanonicalFiles {
  return {
    rules: [
      {
        source: join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
        root: true,
        targets: [],
        description: 'Root rule',
        globs: [],
        body: [
          'See `.agentsmesh/skills/api-gen/SKILL.md`.',
          'Reference `.agentsmesh/skills/api-gen/references/checklist.md`.',
        ].join('\n'),
      },
    ],
    commands: [],
    agents: [],
    skills: [
      {
        source: join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
        name: 'api-gen',
        description: 'Generate APIs',
        body: 'Template at `.agentsmesh/skills/api-gen/references/checklist.md`.',
        supportingFiles: [
          {
            relativePath: 'references/checklist.md',
            absolutePath: join(
              TEST_DIR,
              '.agentsmesh',
              'skills',
              'api-gen',
              'references',
              'checklist.md',
            ),
            content: 'Checklist',
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

describe('global generated file reference rewriting', () => {
  it('rewrites canonical skill file references to colocated Claude paths in global prose output', async () => {
    const results = await generate({
      config: config(),
      canonical: canonical(),
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const root = results.find((result) => result.path === '.claude/CLAUDE.md')?.content ?? '';
    const skill =
      results.find((result) => result.path === '.claude/skills/api-gen/SKILL.md')?.content ?? '';

    // Canonical anchors in inline-code project to the colocated `.claude/...`
    // paths so AI agents reading the generated artifact can navigate without
    // traversing back into the canonical mesh tree.
    expect(root).toContain('`.claude/skills/api-gen/SKILL.md`');
    expect(root).toContain('`.claude/skills/api-gen/references/checklist.md`');
    expect(skill).toContain('`.claude/skills/api-gen/references/checklist.md`');
  });

  it('rewrites canonical markdown destinations in Claude global outputs', async () => {
    const linked = canonical();
    linked.rules[0] = {
      ...linked.rules[0]!,
      body: 'See [skill](.agentsmesh/skills/api-gen/SKILL.md).',
    };
    linked.skills[0] = {
      ...linked.skills[0]!,
      body: 'Template at [checklist](.agentsmesh/skills/api-gen/references/checklist.md).',
    };

    const results = await generate({
      config: config(),
      canonical: linked,
      projectRoot: TEST_DIR,
      scope: 'global',
    });

    const root = results.find((result) => result.path === '.claude/CLAUDE.md')?.content ?? '';
    const skill =
      results.find((result) => result.path === '.claude/skills/api-gen/SKILL.md')?.content ?? '';

    expect(root).toContain('[skill](./skills/api-gen/SKILL.md)');
    expect(skill).toContain('[checklist](./references/checklist.md)');
  });
});
