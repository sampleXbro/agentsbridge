/**
 * Branch coverage for `writeMcpWithMerge` in
 * `src/targets/import/mcp-merge.ts`. Covers:
 *   - destination missing → starts from {} (readFileSafe returns null branch)
 *   - existing parseable JSON → merges with imported servers; imported wins
 *     on name collision
 *   - existing JSON is invalid (parse throws catch branch) → falls back to {}
 *   - existing JSON parses to an array → returns {} (non-object branch)
 *   - existing JSON has `mcpServers` that is an array → returns {} (raw branch)
 *   - entries with non-object server values are skipped (`continue` branch)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeMcpWithMerge } from '../../../../src/targets/import/mcp-merge.js';

let projectRoot: string;
const REL_PATH = '.agentsmesh/mcp.json';
const dest = (): string => join(projectRoot, REL_PATH);

async function readDest(): Promise<{ mcpServers: Record<string, unknown> }> {
  return JSON.parse(await readFile(dest(), 'utf8')) as { mcpServers: Record<string, unknown> };
}

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'mcp-merge-'));
  await mkdir(join(projectRoot, '.agentsmesh'), { recursive: true });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('writeMcpWithMerge branches', () => {
  it('writes mcp.json from scratch when destination is missing', async () => {
    await writeMcpWithMerge(projectRoot, REL_PATH, {
      docs: { command: 'npx', args: ['-y', 'x'] },
    });
    expect((await readDest()).mcpServers).toMatchObject({ docs: { command: 'npx' } });
  });

  it('merges with existing servers; imported wins on name collision', async () => {
    await writeFile(
      dest(),
      JSON.stringify({ mcpServers: { docs: { command: 'old' }, kept: { command: 'k' } } }),
      'utf8',
    );
    await writeMcpWithMerge(projectRoot, REL_PATH, { docs: { command: 'new' } });
    const out = await readDest();
    expect(out.mcpServers).toMatchObject({
      docs: { command: 'new' },
      kept: { command: 'k' },
    });
  });

  it('falls back to {} when existing JSON is malformed', async () => {
    await writeFile(dest(), '{ not json', 'utf8');
    await writeMcpWithMerge(projectRoot, REL_PATH, { docs: { command: 'npx' } });
    expect(Object.keys((await readDest()).mcpServers)).toEqual(['docs']);
  });

  it('ignores existing JSON arrays at the top level (treats as empty)', async () => {
    await writeFile(dest(), JSON.stringify([1, 2, 3]), 'utf8');
    await writeMcpWithMerge(projectRoot, REL_PATH, { docs: { command: 'npx' } });
    expect(Object.keys((await readDest()).mcpServers)).toEqual(['docs']);
  });

  it('ignores mcpServers that is an array (not a record)', async () => {
    await writeFile(dest(), JSON.stringify({ mcpServers: [] }), 'utf8');
    await writeMcpWithMerge(projectRoot, REL_PATH, { docs: { command: 'npx' } });
    expect(Object.keys((await readDest()).mcpServers)).toEqual(['docs']);
  });

  it('skips non-object server entries while preserving valid ones', async () => {
    await writeFile(
      dest(),
      JSON.stringify({
        mcpServers: { good: { command: 'g' }, bad: 'not-an-object', alsoBad: [1] },
      }),
      'utf8',
    );
    await writeMcpWithMerge(projectRoot, REL_PATH, {});
    const out = await readDest();
    expect(out.mcpServers).toMatchObject({ good: { command: 'g' } });
    expect(out.mcpServers).not.toHaveProperty('bad');
    expect(out.mcpServers).not.toHaveProperty('alsoBad');
  });
});
