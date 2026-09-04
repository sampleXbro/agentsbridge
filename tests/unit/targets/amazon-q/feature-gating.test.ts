/**
 * Runs the real generate engine to prove that a feature switched off in
 * `agentsmesh.yaml` never leaks into the Amazon Q agent JSON. Every embedded
 * feature (ignore, hooks, permissions) rides the same file, so the gate has to
 * hold per key, not per file.
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCanonicalFiles } from '../../../../src/canonical/load/loader.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';

const CANONICAL_DIR = join(
  process.cwd(),
  'tests',
  'e2e',
  'fixtures',
  'canonical-full',
  '.agentsmesh',
);

const AGENT_PATH = '.amazonq/cli-agents/code-reviewer.json';

function configWith(features: string[]): ValidatedConfig {
  return {
    version: 1,
    targets: ['amazon-q'],
    features,
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

async function agentJsonFor(features: string[]): Promise<Record<string, unknown> | undefined> {
  const canonical = await loadCanonicalFiles(CANONICAL_DIR);
  const results = await generate({
    config: configWith(features),
    canonical,
    projectRoot: join(tmpdir(), `am-amazon-q-gate-${features.join('-')}`),
    scope: 'project',
  });
  const result = results.find((r) => r.path === AGENT_PATH);
  return result ? (JSON.parse(result.content) as Record<string, unknown>) : undefined;
}

describe('amazon-q generate — embedded features respect config.features', () => {
  it('writes no deniedPaths when the ignore feature is off', async () => {
    const parsed = await agentJsonFor(['rules', 'agents']);
    expect(parsed).toBeDefined();
    expect(parsed).not.toHaveProperty('toolsSettings');
  });

  it('writes no hooks when the hooks feature is off', async () => {
    const parsed = await agentJsonFor(['rules', 'agents']);
    expect(parsed).not.toHaveProperty('hooks');
  });

  it('keeps only the agent-owned tools when the permissions feature is off', async () => {
    const parsed = await agentJsonFor(['rules', 'agents']);
    expect(parsed!.allowedTools).toEqual(['Read', 'Glob', 'Grep']);
  });

  it('merges canonical permissions.allow once the permissions feature is on', async () => {
    const parsed = await agentJsonFor(['rules', 'agents', 'permissions']);
    expect(parsed!.allowedTools).toEqual(['Read', 'Glob', 'Grep', 'LS', 'Bash(npm run test:*)']);
  });

  it('still points the agent at the rules glob when only agents is on', async () => {
    const parsed = await agentJsonFor(['agents']);
    expect(parsed!.resources).toEqual([
      'file://AmazonQ.md',
      'file://AGENTS.md',
      'file://README.md',
      'file://.amazonq/rules/**/*.md',
    ]);
  });

  it('writes deniedPaths once the ignore feature is on', async () => {
    const parsed = await agentJsonFor(['rules', 'agents', 'ignore']);
    expect(parsed!.toolsSettings).toEqual({
      fs_read: { deniedPaths: ['node_modules', 'dist', '.env', '*.log'] },
      fs_write: { deniedPaths: ['node_modules', 'dist', '.env', '*.log'] },
    });
  });

  it('emits no agent file at all when the agents feature is off', async () => {
    expect(await agentJsonFor(['rules', 'ignore', 'hooks', 'permissions'])).toBeUndefined();
  });
});
