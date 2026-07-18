import { describe, expect, it, beforeAll } from 'vitest';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCanonicalFiles } from '../../src/canonical/load/loader.js';
import { generate } from '../../src/core/generate/engine.js';
import { getTargetCapabilities } from '../../src/targets/catalog/builtin-targets.js';
import { loadCapabilityLedger } from '../../src/core/capabilities/ledger.js';
import { checkConformance } from '../../src/core/capabilities/fingerprint.js';
import { verifyLedgerIntegrity } from '../../src/core/capabilities/audit-report.js';
import { TARGET_IDS } from '../../src/targets/catalog/target-ids.js';
import type { GenerateResult } from '../../src/core/result-types.js';
import type { ValidatedConfig } from '../../src/config/core/schema.js';
import type { LedgerCell } from '../../src/core/capabilities/ledger-types.js';
import { MATRIX_CONFIG } from './matrix-config.js';

// ---------------------------------------------------------------------------
// Explicit skip list — cells that cannot be asserted via the in-process
// engine for a structural reason. Each entry must document WHY.
// ---------------------------------------------------------------------------
const SKIP_CELLS: ReadonlySet<string> = new Set([
  // Path is a directory indicator, not a concrete file the generator emits.
  // The ledger path ".config/amp/skills" records the skill-dir root; actual
  // files land at ".config/amp/skills/<name>/SKILL.md". No single path to assert.
  'amp/skills/global',

  // Same pattern: ".gemini/config/skills/" is a directory root placeholder.
  'antigravity/skills/global',

  // "<name>" is a variable substitution; the ledger records the pattern not a
  // concrete path. The fixture's api-generator skill lands at a different prefix.
  'goose/skills/global',

  // deepagents-cli hooks are emitted only from canonical hooks that include
  // SessionStart/SessionEnd/UserPromptSubmit/Stop/PreCompact events. The
  // canonical-full fixture only has PostToolUse which has no mapping in
  // toDeepagentsHooks — so scopeExtras returns [] and no file is emitted.
  // Adding a deepagents-specific hook fixture would diverge from the shared
  // canonical used by all other cells; the cell itself is correctly specified.
  'deepagents-cli/hooks/global',
]);

function skipKey(cell: LedgerCell): string {
  return `${cell.target}/${cell.feature}/${cell.scope}`;
}

// ---------------------------------------------------------------------------
// Shared canonical & config — loaded once before all tests
// ---------------------------------------------------------------------------
const CANONICAL_DIR = join(
  process.cwd(),
  'tests',
  'e2e',
  'fixtures',
  'canonical-full',
  '.agentsmesh',
);

const ALL_FEATURES: ValidatedConfig['features'] = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
];

function parseTargetsFromMatrixConfig(config: string): string[] {
  const match = /^targets:\n((?: {2}- .+\n)+)/m.exec(config);
  if (!match) return [];
  return match[1]
    .split('\n')
    .filter((l) => l.trim().startsWith('- '))
    .map((l) => l.trim().slice(2).trim());
}

// Results cache: target -> GenerateResult[]
const resultsCache = new Map<string, GenerateResult[]>();
const FIXTURE_ROOT = join(tmpdir(), 'am-ledger-global-conformance');

const ledger = loadCapabilityLedger();

const globalNativeCells = ledger.cells.filter((c) => {
  if (c.scope !== 'global') return false;
  const level = getTargetCapabilities(c.target, 'global')?.[c.feature]?.level ?? 'none';
  return level === 'native' || level === 'embedded';
});

// All targets present in matrix config (same set as project conformance).
const matrixTargets = new Set(parseTargetsFromMatrixConfig(MATRIX_CONFIG));

describe('capability ledger conformance (global)', () => {
  it('has a well-formed ledger', () => {
    expect(Array.isArray(ledger.cells)).toBe(true);
  });

  it('has no orphan, invalid, or duplicate cells', () => {
    expect(verifyLedgerIntegrity(ledger, [...TARGET_IDS])).toEqual([]);
  });

  // Load canonical once; warm result cache for every unique target in our cell set.
  beforeAll(async () => {
    const canonical = await loadCanonicalFiles(CANONICAL_DIR);

    const uniqueTargets = [...new Set(globalNativeCells.map((c) => c.target))];
    await Promise.all(
      uniqueTargets.map(async (target) => {
        if (!matrixTargets.has(target)) return; // skip targets not in MATRIX_CONFIG
        const config: ValidatedConfig = {
          version: 1,
          targets: [target],
          features: ALL_FEATURES,
          extends: [],
          overrides: {},
          collaboration: { strategy: 'merge', lock_features: [] },
        } as ValidatedConfig;
        const results = await generate({
          config,
          canonical,
          projectRoot: FIXTURE_ROOT,
          scope: 'global',
        });
        resultsCache.set(target, results);
      }),
    );
  }, 60_000);

  const cases = globalNativeCells.map((c) => [`${c.target}/${c.feature} (global)`, c] as const);

  it.each(cases.length > 0 ? cases : [['<empty-ledger>', null] as const])(
    'generated output for %s matches its ledger fingerprint',
    (_label, cell) => {
      if (cell === null) return;

      const key = skipKey(cell);
      if (SKIP_CELLS.has(key)) {
        // Explicit structural skip — not a silent ignore.
        return;
      }

      if (!matrixTargets.has(cell.target)) {
        // Target is not in MATRIX_CONFIG (cloud-only target without global support
        // that somehow has a global cell — should not happen, but guard gracefully).
        return;
      }

      const results = resultsCache.get(cell.target) ?? [];
      const match = results.find((r) => r.target === cell.target && r.path === cell.path);

      expect(
        match,
        `${cell.target}/${cell.feature}: no result emitted at path "${cell.path}". ` +
          `Emitted paths: ${results.map((r) => r.path).join(', ')}`,
      ).toBeDefined();

      if (!match) return;

      const actualExt = extname(cell.path).toLowerCase();
      const issues = checkConformance(cell, actualExt, match.content);
      expect(issues, `${cell.target}/${cell.feature}: ${issues.join('; ')}`).toEqual([]);
    },
  );
});
