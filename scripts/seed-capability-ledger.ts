/**
 * Seed the capability ledger with fingerprint SKELETONS derived from currently
 * generated output.
 *
 * Usage:
 *   pnpm capabilities:seed
 *
 * For each project-scope target × feature whose descriptor level is
 * `native`/`embedded`, generate a throwaway project with ONLY that feature
 * enabled, attribute the single structured file the feature emits, derive its
 * fingerprint, and write a cell with EMPTY provenance (`verifiedAt: null`,
 * `verdict: 'unverified'`, `source: []`) for the audit skill to fill in later.
 *
 * Attribution is by GENERATION, not filename heuristics: if a single-feature
 * generation leaves exactly one file (after removing the root instruction file
 * for non-`rules` features), that file is the feature's file. Zero / many files,
 * or an unstructured extension, are skipped and reported for manual research.
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGenerate } from '../src/cli/commands/generate.js';
import { TARGET_IDS } from '../src/targets/catalog/target-ids.js';
import {
  getTargetCapabilities,
  getTargetPrimaryRootInstructionPath,
} from '../src/targets/catalog/builtin-targets.js';
import { deriveFingerprint, parseByFormat } from '../src/core/capabilities/fingerprint.js';
import type { CapabilityFeatureKey } from '../src/targets/catalog/capabilities.js';
import type { LedgerCell, LedgerFormat } from '../src/core/capabilities/ledger-types.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_AGENTSMESH = join(ROOT, 'tests/e2e/fixtures/canonical-full/.agentsmesh');
const LEDGER_PATH = join(ROOT, 'src/targets/catalog/capability-ledger.json');

const SEED_FEATURES: readonly CapabilityFeatureKey[] = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'ignore',
  'permissions',
];

function formatForExt(ext: string): LedgerFormat | null {
  if (ext === '.json') return 'json';
  if (ext === '.toml') return 'toml';
  if (ext === '.yaml' || ext === '.yml') return 'yaml';
  if (ext === '.md' || ext === '.mdc') return 'md-frontmatter';
  return null;
}

/** Recursively list files under `dir`, returning paths relative to `dir` (posix `/`). */
function listFilesRelative(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRelative(abs, base));
    } else if (entry.isFile()) {
      out.push(abs.slice(base.length + 1).replaceAll('\\', '/'));
    }
  }
  return out;
}

function configFor(target: string, feature: CapabilityFeatureKey): string {
  return `version: 1\ntargets:\n  - ${target}\nfeatures:\n  - ${feature}\n`;
}

type SeedOutcome = { cell: LedgerCell } | { skip: string };

/**
 * Generate a throwaway project for `target` with ONLY `feature` enabled,
 * attribute its single structured file, and return either a seeded cell or a
 * skip reason. Every generation runs in its own temp dir which is always removed.
 */
async function seedTargetFeature(
  target: string,
  feature: CapabilityFeatureKey,
  level: LedgerCell['maxAchievable'],
): Promise<SeedOutcome> {
  const dir = mkdtempSync(join(tmpdir(), 'amsh-seed-'));
  try {
    cpSync(FIXTURE_AGENTSMESH, join(dir, '.agentsmesh'), { recursive: true });
    writeFileSync(join(dir, 'agentsmesh.yaml'), configFor(target, feature));
    try {
      await runGenerate({ targets: target }, dir, { printMatrix: false });
    } catch {
      return { skip: `${target}/${feature} (generate threw)` };
    }

    let candidates = listFilesRelative(dir).filter(
      (rel) => rel !== 'agentsmesh.yaml' && !rel.startsWith('.agentsmesh/'),
    );
    if (feature !== 'rules') {
      const rootPath = getTargetPrimaryRootInstructionPath(target, 'project');
      if (rootPath !== undefined) candidates = candidates.filter((rel) => rel !== rootPath);
    }

    if (candidates.length !== 1) {
      return { skip: `${target}/${feature} (${candidates.length} files)` };
    }

    const rel = candidates[0];
    const ext = extname(rel).toLowerCase();
    const format = formatForExt(ext);
    if (format === null) {
      return { skip: `${target}/${feature} (ext "${ext}")` };
    }

    const raw = readFileSync(join(dir, rel), 'utf-8');
    const parsed = parseByFormat(raw, format);
    const fingerprint = deriveFingerprint(parsed, format);
    return {
      cell: {
        target,
        feature,
        scope: 'project',
        maxAchievable: level,
        path: rel,
        ext,
        format,
        fingerprint,
        source: [],
        verifiedAt: null,
        verdict: 'unverified',
        rejectionReason: null,
      },
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const cells: LedgerCell[] = [];
  const skipped: string[] = [];

  for (const target of TARGET_IDS) {
    for (const feature of SEED_FEATURES) {
      const level = getTargetCapabilities(target, 'project')?.[feature]?.level ?? 'none';
      if (level !== 'native' && level !== 'embedded') continue;

      const outcome = await seedTargetFeature(target, feature, level);
      if ('skip' in outcome) skipped.push(outcome.skip);
      else cells.push(outcome.cell);
    }
  }

  cells.sort((a, b) => `${a.target}/${a.feature}`.localeCompare(`${b.target}/${b.feature}`));
  writeFileSync(LEDGER_PATH, `${JSON.stringify({ cells }, null, 2)}\n`);

  process.stdout.write(`seeded ${cells.length} cells; skipped ${skipped.length}:\n`);
  for (const s of skipped) process.stdout.write(`  - ${s}\n`);
}

await main();
