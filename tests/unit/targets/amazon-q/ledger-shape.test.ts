/**
 * Pins the artifact shape the capability ledger records for amazon-q: which file
 * carries each embedded feature and which top-level keys it must contain. Runs the
 * real generate engine over the shared canonical fixture, exactly like the ledger
 * conformance suite does.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCanonicalFiles } from '../../../../src/canonical/load/loader.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { GenerateResult } from '../../../../src/core/result-types.js';
import type { TargetLayoutScope } from '../../../../src/targets/catalog/target-descriptor.js';

const CANONICAL_DIR = join(
  process.cwd(),
  'tests',
  'e2e',
  'fixtures',
  'canonical-full',
  '.agentsmesh',
);

const CONFIG: ValidatedConfig = {
  version: 1,
  targets: ['amazon-q'],
  features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'hooks', 'ignore', 'permissions'],
  extends: [],
  overrides: {},
  collaboration: { strategy: 'merge', lock_features: [] },
} as ValidatedConfig;

const byScope = new Map<TargetLayoutScope, GenerateResult[]>();

function keysAt(scope: TargetLayoutScope, path: string): string[] {
  const result = byScope.get(scope)!.find((r) => r.path === path);
  expect(result, `no output at ${path} (${scope})`).toBeDefined();
  return Object.keys(JSON.parse(result!.content) as Record<string, unknown>);
}

describe('amazon-q generated artifact shape', () => {
  beforeAll(async () => {
    const canonical = await loadCanonicalFiles(CANONICAL_DIR);
    for (const scope of ['project', 'global'] as const) {
      byScope.set(
        scope,
        await generate({
          config: CONFIG,
          canonical,
          projectRoot: join(tmpdir(), `am-amazon-q-shape-${scope}`),
          scope,
        }),
      );
    }
  }, 30_000);

  it('emits exactly the expected project files', () => {
    expect(
      byScope
        .get('project')!
        .map((r) => r.path)
        .sort(),
    ).toEqual([
      '.amazonq/cli-agents/code-reviewer.json',
      '.amazonq/cli-agents/researcher.json',
      '.amazonq/mcp.json',
      '.amazonq/prompts/review.md',
      '.amazonq/rules/_root.md',
      '.amazonq/rules/typescript.md',
    ]);
  });

  it('emits exactly the expected global files', () => {
    expect(
      byScope
        .get('global')!
        .map((r) => r.path)
        .sort(),
    ).toEqual([
      '.aws/amazonq/cli-agents/code-reviewer.json',
      '.aws/amazonq/cli-agents/researcher.json',
      '.aws/amazonq/mcp.json',
      '.aws/amazonq/prompts/review.md',
      '.aws/amazonq/rules/_root.md',
      '.aws/amazonq/rules/typescript.md',
    ]);
  });

  it('carries ignore, permissions, hooks and rule resources in the project agent JSON', () => {
    expect(keysAt('project', '.amazonq/cli-agents/code-reviewer.json')).toEqual([
      'name',
      'description',
      'prompt',
      'allowedTools',
      'resources',
      'hooks',
      'toolsSettings',
    ]);
  });

  it('carries the same embedded keys in the global agent JSON', () => {
    expect(keysAt('global', '.aws/amazonq/cli-agents/code-reviewer.json')).toEqual([
      'name',
      'description',
      'prompt',
      'allowedTools',
      'resources',
      'hooks',
      'toolsSettings',
    ]);
  });

  it('writes the canonical ignore patterns as deniedPaths on both path tools', () => {
    const result = byScope
      .get('project')!
      .find((r) => r.path === '.amazonq/cli-agents/code-reviewer.json')!;
    const parsed = JSON.parse(result.content) as {
      toolsSettings: Record<string, { deniedPaths: string[] }>;
    };
    expect(parsed.toolsSettings).toEqual({
      fs_read: { deniedPaths: ['node_modules', 'dist', '.env', '*.log'] },
      fs_write: { deniedPaths: ['node_modules', 'dist', '.env', '*.log'] },
    });
  });

  it('points the global agent at both the project and home rules globs', () => {
    const result = byScope
      .get('global')!
      .find((r) => r.path === '.aws/amazonq/cli-agents/researcher.json')!;
    const parsed = JSON.parse(result.content) as { resources: string[] };
    expect(parsed.resources).toEqual([
      'file://AmazonQ.md',
      'file://AGENTS.md',
      'file://README.md',
      'file://.amazonq/rules/**/*.md',
      'file://~/.aws/amazonq/rules/**/*.md',
    ]);
  });
});
