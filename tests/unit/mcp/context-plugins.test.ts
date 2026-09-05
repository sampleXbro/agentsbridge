/** MCP must see plugin targets declared in agentsmesh.yaml, like the CLI does. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveContext } from '../../../src/mcp/context.js';
import { capabilitiesHandlers } from '../../../src/mcp/handlers/capabilities.js';
import { getDescriptor, resetRegistry } from '../../../src/targets/catalog/registry.js';

const FIXTURE = join(process.cwd(), 'tests/fixtures/plugins/rich-plugin');
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'am-'));
  await cp(FIXTURE, join(root, 'plugins/rich-plugin'), { recursive: true });
});

afterEach(async () => {
  resetRegistry();
  await rm(root, { recursive: true, force: true });
});

describe('resolveContext: plugin bootstrap', () => {
  it('registers plugins from agentsmesh.yaml so capabilities tools can see them', async () => {
    await writeFile(
      join(root, 'agentsmesh.yaml'),
      'version: 1\ntargets: []\nfeatures: []\nplugins:\n  - id: rich-plugin\n    source: ./plugins/rich-plugin\n',
      'utf8',
    );
    await resolveContext({ cwd: root });
    expect(getDescriptor('rich-plugin')?.id).toBe('rich-plugin');
    const entry = await capabilitiesHandlers.get({ targetId: 'rich-plugin' });
    expect(entry.targetId).toBe('rich-plugin');
  });

  it('bootstraps a root once and reuses the registration on later calls', async () => {
    await writeFile(
      join(root, 'agentsmesh.yaml'),
      'version: 1\ntargets: []\nfeatures: []\nplugins:\n  - id: rich-plugin\n    source: ./plugins/rich-plugin\n',
      'utf8',
    );
    await resolveContext({ cwd: root });
    resetRegistry();
    // Same root: memoized, so the registry is NOT repopulated.
    await resolveContext({ cwd: root });
    expect(getDescriptor('rich-plugin')).toBeUndefined();
  });

  it('still resolves when the config cannot be loaded (plugins are optional)', async () => {
    await writeFile(
      join(root, 'agentsmesh.yaml'),
      'version: 1\ntargets: [not-a-real-target]\n',
      'utf8',
    );
    const ctx = await resolveContext({ cwd: root });
    expect(ctx.projectRoot).toBe(root);
  });
});
