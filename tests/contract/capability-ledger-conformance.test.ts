import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { createCanonicalProject } from '../e2e/helpers/canonical.js';
import { cleanup } from '../e2e/helpers/setup.js';
import { runGenerate } from '../../src/cli/commands/generate.js';
import { getTargetCapabilities } from '../../src/targets/catalog/builtin-targets.js';
import { loadCapabilityLedger } from '../../src/core/capabilities/ledger.js';
import { checkConformance } from '../../src/core/capabilities/fingerprint.js';
import { MATRIX_CONFIG } from './matrix-config.js';

let dir = '';
afterEach(() => {
  if (dir) cleanup(dir);
  dir = '';
});

const ledger = loadCapabilityLedger();
// Only project-scope cells are covered by MATRIX_CONFIG generation; global cells are asserted separately once wired.
const projectNativeCells = ledger.cells.filter((c) => {
  if (c.scope !== 'project') return false;
  const level = getTargetCapabilities(c.target, 'project')?.[c.feature]?.level ?? 'none';
  return level === 'native' || level === 'embedded';
});

describe('capability ledger conformance (project)', () => {
  it('has a well-formed ledger', () => {
    expect(Array.isArray(ledger.cells)).toBe(true);
  });

  const cases = projectNativeCells.map((c) => [`${c.target}/${c.feature}`, c] as const);
  it.each(cases.length > 0 ? cases : [['<empty-ledger>', null] as const])(
    'generated output for %s matches its ledger fingerprint',
    async (_label, cell) => {
      if (cell === null) return; // empty ledger — nothing to assert yet
      dir = createCanonicalProject(MATRIX_CONFIG);
      expect((await runGenerate({ targets: cell.target }, dir, { printMatrix: false })).exitCode).toBe(0);
      const abs = join(dir, cell.path);
      expect(existsSync(abs), `${cell.target}/${cell.feature}: expected file at ${cell.path}`).toBe(true);
      const issues = checkConformance(cell, extname(cell.path).toLowerCase(), readFileSync(abs, 'utf-8'));
      expect(issues, `${cell.target}/${cell.feature}: ${issues.join('; ')}`).toEqual([]);
    },
  );
});
