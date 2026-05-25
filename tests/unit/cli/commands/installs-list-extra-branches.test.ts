/**
 * Branch coverage for src/cli/commands/installs-list.ts line 43-45 —
 * the catch block when .agentsmesh-install-manifest.json is invalid JSON.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import { runInstalls } from '../../../../src/cli/commands/installs.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'agentsmesh-installs-list-extra-'));
  await writeFile(
    join(tmpDir, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
  );
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('installs list - manifest JSON edge branches', () => {
  it('treats an invalid-JSON pack manifest as missing metadata (catch branch)', async () => {
    await mkdir(join(tmpDir, '.agentsmesh', 'packs', 'pack-a'), { recursive: true });
    await writeFile(
      join(tmpDir, '.agentsmesh', 'installs.yaml'),
      stringifyYaml({
        version: 1,
        installs: [
          {
            name: 'pack-a',
            source: 'github:foo/bar',
            source_kind: 'github',
            features: ['rules'],
          },
        ],
      }),
    );
    await writeFile(
      join(tmpDir, '.agentsmesh', 'packs', 'pack-a', '.agentsmesh-install-manifest.json'),
      '{ this is :: not json ::',
    );

    const result = await runInstalls({}, ['list'], tmpDir);

    expect(result.exitCode).toBe(0);
    expect(result.data.installs).toHaveLength(1);
    expect(result.data.installs[0]!.installed_at).toBeNull();
    expect(result.data.installs[0]!.source_type).toBeNull();
  });

  it('coerces non-string installed_at / source_type values to null', async () => {
    await mkdir(join(tmpDir, '.agentsmesh', 'packs', 'pack-b'), { recursive: true });
    await writeFile(
      join(tmpDir, '.agentsmesh', 'installs.yaml'),
      stringifyYaml({
        version: 1,
        installs: [
          {
            name: 'pack-b',
            source: 'local:./somewhere',
            source_kind: 'local',
            features: ['rules'],
          },
        ],
      }),
    );
    await writeFile(
      join(tmpDir, '.agentsmesh', 'packs', 'pack-b', '.agentsmesh-install-manifest.json'),
      JSON.stringify({ installed_at: 42, source_type: { weird: true } }),
    );

    const result = await runInstalls({}, ['list'], tmpDir);

    expect(result.data.installs[0]!.installed_at).toBeNull();
    expect(result.data.installs[0]!.source_type).toBeNull();
  });
});
