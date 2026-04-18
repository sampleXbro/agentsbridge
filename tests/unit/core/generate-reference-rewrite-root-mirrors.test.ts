import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { generate } from '../../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';

const TEST_DIR = join(tmpdir(), 'am-engine-root-mirror-reference-rewrite');

function config(): ValidatedConfig {
  return {
    version: 1,
    targets: ['cursor'],
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
        body: 'Use `post-feature-qa` skill (`.agentsmesh/skills/post-feature-qa/`).',
      },
    ],
    commands: [],
    agents: [],
    skills: [
      {
        source: join(TEST_DIR, '.agentsmesh', 'skills', 'post-feature-qa', 'SKILL.md'),
        name: 'post-feature-qa',
        description: 'QA pass',
        body: '# QA',
        supportingFiles: [],
      },
    ],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('root mirror reference rewriting', () => {
  it('rewrites canonical skill directory links in Cursor .cursor/AGENTS.md', async () => {
    const results = await generate({
      config: config(),
      canonical: canonical(),
      projectRoot: TEST_DIR,
    });

    const content = results.find((result) => result.path === '.cursor/AGENTS.md')?.content ?? '';

    expect(content).toContain('./skills/post-feature-qa/');
    expect(content).not.toContain('`skills/post-feature-qa/`');
    expect(content).not.toContain('.agentsmesh/skills/post-feature-qa/');
    for (const result of results.filter((item) => item.path.endsWith('.md'))) {
      expect(result.content).not.toContain('.agentsmesh/skills/post-feature-qa/');
    }
  });
});
