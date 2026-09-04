/**
 * Pins the generated `.aider.conf.yml` shape recorded in the capability ledger
 * (target `aider`, feature `hooks`, both scopes) against the shared
 * canonical-full fixture the ledger conformance tests generate from.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';
import { loadCanonicalFiles } from '../../../../src/canonical/load/loader.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles, GenerateResult } from '../../../../src/core/types.js';
import { AIDER_CONF_FILE } from '../../../../src/targets/aider/constants.js';

const FIXTURE = join(process.cwd(), 'tests', 'e2e', 'fixtures', 'canonical-full', '.agentsmesh');
const ROOT = join(tmpdir(), 'am-aider-ledger-shape');

const CONFIG = {
  version: 1,
  targets: ['aider'],
  features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'hooks', 'ignore', 'permissions'],
  extends: [],
  overrides: {},
  collaboration: { strategy: 'merge', lock_features: [] },
} as ValidatedConfig;

let canonical: CanonicalFiles;

async function generateConf(scope: 'project' | 'global'): Promise<GenerateResult> {
  const results = await generate({ config: CONFIG, canonical, projectRoot: ROOT, scope });
  const conf = results.find((r) => r.target === 'aider' && r.path === AIDER_CONF_FILE);
  expect(conf, `no .aider.conf.yml emitted in ${scope} scope`).toBeDefined();
  return conf!;
}

describe('aider hooks ledger shape', () => {
  beforeAll(async () => {
    canonical = await loadCanonicalFiles(FIXTURE);
  });

  it('emits read: plus the lint keys at .aider.conf.yml in project scope', async () => {
    const parsed = parseYaml((await generateConf('project')).content) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['read', 'lint-cmd', 'auto-lint']);
    expect(parsed['lint-cmd']).toEqual(['prettier --write $FILE_PATH']);
    expect(parsed['auto-lint']).toBe(true);
  });

  it('emits only the lint keys at .aider.conf.yml in global scope', async () => {
    const parsed = parseYaml((await generateConf('global')).content) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['lint-cmd', 'auto-lint']);
  });
});
