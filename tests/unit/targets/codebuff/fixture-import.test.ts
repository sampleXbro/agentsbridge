/**
 * Pins the source-derived Codebuff layout against a realistic project fixture.
 *
 * There is no Codebuff docs site to fall back on (freebuff.com/docs is 404),
 * so this fixture IS the specification: if any of these paths move, the target
 * is wrong and this test is the thing that says so.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, cleanup } from '../../../e2e/helpers/setup.js';
import { canonicalPathsOnDisk } from '../../../contract/matrix-helpers.js';
import { importFromCodebuff } from '../../../../src/targets/codebuff/importer.js';

let dir = '';

afterEach(() => {
  if (dir) cleanup(dir);
  dir = '';
});

describe('codebuff fixture import', () => {
  it('imports every configured surface and nothing else', async () => {
    dir = createTestProject('codebuff-project');

    await importFromCodebuff(dir, { scope: 'project' });

    expect(canonicalPathsOnDisk(dir)).toEqual([
      '.agentsmesh/commands/review.md',
      '.agentsmesh/ignore',
      '.agentsmesh/mcp.json',
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/rules/src.md',
      '.agentsmesh/skills/api-generator/SKILL.md',
      '.agentsmesh/skills/api-generator/references/route-checklist.md',
    ]);
  });

  it('maps the root and nested knowledge files to the right canonical rules', async () => {
    dir = createTestProject('codebuff-project');

    await importFromCodebuff(dir, { scope: 'project' });

    const root = readFileSync(join(dir, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(root).toContain('root: true');
    expect(root).toContain('# Orders API');

    const nested = readFileSync(join(dir, '.agentsmesh/rules/src.md'), 'utf-8');
    expect(nested).toContain('root: false');
    expect(nested).toContain('- src/**');
    expect(nested).toContain('noUncheckedIndexedAccess');
  });

  it('recovers the projected command, keeping its name and allowed tools', async () => {
    dir = createTestProject('codebuff-project');

    await importFromCodebuff(dir, { scope: 'project' });

    const command = readFileSync(join(dir, '.agentsmesh/commands/review.md'), 'utf-8');
    expect(command).toContain('git diff --staged');
    expect(command).toContain('run_terminal_command');
  });

  it('reads stdio and remote mcp servers from the mcpServers key of .agents/mcp.json', async () => {
    dir = createTestProject('codebuff-project');

    await importFromCodebuff(dir, { scope: 'project' });

    const mcp = JSON.parse(readFileSync(join(dir, '.agentsmesh/mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(Object.keys(mcp.mcpServers).sort()).toEqual(['github', 'postgres', 'sentry']);
    expect(mcp.mcpServers.sentry).toMatchObject({
      type: 'http',
      url: 'https://mcp.sentry.dev/mcp',
      headers: { Authorization: 'Bearer $SENTRY_TOKEN' },
    });
  });

  it('reads .codebuffignore as gitignore-syntax patterns', async () => {
    dir = createTestProject('codebuff-project');

    await importFromCodebuff(dir, { scope: 'project' });

    expect(readFileSync(join(dir, '.agentsmesh/ignore'), 'utf-8').split('\n')).toEqual([
      'dist/',
      'coverage/',
      'node_modules/',
      '*.log',
      '.env',
      '.env.*',
      'db/snapshots/',
    ]);
  });

  it('never imports user-authored agent modules as canonical agents', async () => {
    dir = createTestProject('codebuff-project');

    await importFromCodebuff(dir, { scope: 'project' });

    expect(existsSync(join(dir, '.agentsmesh/agents'))).toBe(false);
    expect(existsSync(join(dir, '.agents/my-custom-agent.ts'))).toBe(true);
  });
});
