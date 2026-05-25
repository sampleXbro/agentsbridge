/**
 * Security: deep-merge over `agentsmesh.local.yaml` must not allow attacker
 * keys (`__proto__`, `constructor`, `prototype`) to mutate `Object.prototype`.
 *
 * `yaml` v2 already drops `__proto__` during parsing, but `constructor.prototype`
 * traverses as a normal object path through `deepMergeObjects`. Without an
 * explicit denylist the merge writes onto `Object.prototype` and every
 * subsequent `{}` in the process inherits the polluted property.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfigFromExactDir } from '../../../src/config/core/loader.js';

const HOSTILE_KEY = 'AM_PROTOTYPE_POLLUTION_PROBE';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-proto-pollute-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  // Cleanup the prototype regardless of test outcome so a leak doesn't
  // poison the rest of the test process.
  delete (Object.prototype as Record<string, unknown>)[HOSTILE_KEY];
});

function writeBaseConfig(): void {
  writeFileSync(
    join(dir, 'agentsmesh.yaml'),
    ['version: 1', 'targets: ["claude-code"]', 'features: ["rules"]', 'overrides: {}', ''].join(
      '\n',
    ),
  );
}

describe('deepMergeObjects — prototype pollution', () => {
  it('does not pollute Object.prototype via constructor.prototype payload', async () => {
    writeBaseConfig();
    writeFileSync(
      join(dir, 'agentsmesh.local.yaml'),
      ['overrides:', '  constructor:', '    prototype:', `      ${HOSTILE_KEY}: "PWNED"`, ''].join(
        '\n',
      ),
    );

    await loadConfigFromExactDir(dir);

    expect(({} as Record<string, unknown>)[HOSTILE_KEY]).toBeUndefined();
    expect(HOSTILE_KEY in Object.prototype).toBe(false);
  });

  it('does not pollute Object.prototype via __proto__ payload', async () => {
    writeBaseConfig();
    writeFileSync(
      join(dir, 'agentsmesh.local.yaml'),
      ['overrides:', '  __proto__:', `    ${HOSTILE_KEY}: "PWNED"`, ''].join('\n'),
    );

    await loadConfigFromExactDir(dir);

    expect(({} as Record<string, unknown>)[HOSTILE_KEY]).toBeUndefined();
    expect(HOSTILE_KEY in Object.prototype).toBe(false);
  });

  it('still merges legitimate overrides keys', async () => {
    writeBaseConfig();
    writeFileSync(
      join(dir, 'agentsmesh.local.yaml'),
      ['overrides:', '  "claude-code":', '    rules: {flat: true}', ''].join('\n'),
    );

    const { config } = await loadConfigFromExactDir(dir);
    const overrides = config.overrides as Record<string, unknown> | undefined;
    expect(overrides?.['claude-code']).toBeDefined();
  });
});
