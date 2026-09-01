/**
 * Pins the generated `.trae/permission/global.json` shape recorded in the
 * capability ledger (target `trae`, feature `permissions`, global scope)
 * against the shared canonical-full fixture the ledger conformance tests
 * generate from.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCanonicalFiles } from '../../../../src/canonical/load/loader.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { TRAE_GLOBAL_PERMISSIONS_FILE } from '../../../../src/targets/trae/constants.js';

const FIXTURE = join(process.cwd(), 'tests', 'e2e', 'fixtures', 'canonical-full', '.agentsmesh');
const ROOT = join(tmpdir(), 'am-trae-ledger-shape');

const CONFIG = {
  version: 1,
  targets: ['trae'],
  features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'hooks', 'ignore', 'permissions'],
  extends: [],
  overrides: {},
  collaboration: { strategy: 'merge', lock_features: [] },
} as ValidatedConfig;

let canonical: CanonicalFiles;

describe('trae permissions ledger shape', () => {
  beforeAll(async () => {
    canonical = await loadCanonicalFiles(FIXTURE);
  });

  it('emits resourceAuthorization and customProfiles at the global permission path', async () => {
    const results = await generate({
      config: CONFIG,
      canonical,
      projectRoot: ROOT,
      scope: 'global',
    });
    const file = results.find(
      (r) => r.target === 'trae' && r.path === TRAE_GLOBAL_PERMISSIONS_FILE,
    );

    expect(file).toBeDefined();
    const json = JSON.parse(file!.content) as Record<string, never>;
    expect(Object.keys(json)).toEqual(['customProfiles', 'resourceAuthorization']);
    expect(json).toMatchObject({
      customProfiles: {
        defaultCustomProfile: {
          approval: {
            commandRules: {
              prefix: { 'npm run test': { approval: 'allow' }, curl: { approval: 'deny' } },
            },
          },
        },
      },
      resourceAuthorization: { filesystem: { readWrite: [], readOnly: [] } },
    });
  });
});
