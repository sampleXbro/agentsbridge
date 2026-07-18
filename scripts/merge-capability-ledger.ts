/**
 * Merge-build a comprehensive capability ledger from all builtin target descriptors.
 *
 * Unlike `seed-capability-ledger.ts`, this script:
 *   - Covers BOTH scopes (project + global)
 *   - Includes ALL capability levels (none/partial/embedded/native)
 *   - PRESERVES existing verified/rejected cells' provenance data
 *   - Derives paths from descriptor layouts without running full generation
 *
 * Usage:  node --import tsx/esm scripts/merge-capability-ledger.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGET_IDS } from '../src/targets/catalog/target-ids.js';
import {
  getTargetCapabilities,
  getTargetLayout,
  getTargetPrimaryRootInstructionPath,
} from '../src/targets/catalog/builtin-targets.js';
import type { CapabilityFeatureKey } from '../src/targets/catalog/capabilities.js';
import type { TargetLayoutScope } from '../src/targets/catalog/target-descriptor.js';
import type { LedgerCell, LedgerFormat } from '../src/core/capabilities/ledger-types.js';
import { CAPABILITY_FEATURES, CAPABILITY_SCOPES } from '../src/core/capabilities/ledger-types.js';
import { mergeCell } from '../src/core/capabilities/merge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER_PATH = join(ROOT, 'src/targets/catalog/capability-ledger.json');

function cellKey(target: string, feature: string, scope: string): string {
  return `${target}/${feature}/${scope}`;
}

function formatForExt(ext: string): LedgerFormat {
  if (ext === '.json' || ext === '.jsonc') return 'json';
  if (ext === '.toml') return 'toml';
  if (ext === '.yaml' || ext === '.yml') return 'yaml';
  if (ext === '.md' || ext === '.mdc' || ext === '.mdx') return 'md-frontmatter';
  if (ext === '.sh' || ext === '.bash' || ext === '.py' || ext === '.star' || ext === '.rules') {
    return 'text';
  }
  // Unknown extensions fall back to md-frontmatter (existing cells preserved via mergeCell).
  return 'md-frontmatter';
}

function derivePath(
  target: string,
  feature: CapabilityFeatureKey,
  scope: TargetLayoutScope,
): string {
  const layout = getTargetLayout(target, scope);
  if (!layout) return '';

  switch (feature) {
    case 'rules': {
      const root = getTargetPrimaryRootInstructionPath(target, scope);
      return root ?? '';
    }
    case 'commands': {
      if (layout.paths?.commandPath) {
        try {
          const p = layout.paths.commandPath('review', {} as never);
          return p ?? '';
        } catch {
          return '';
        }
      }
      return '';
    }
    case 'agents': {
      if (layout.paths?.agentPath) {
        try {
          const p = layout.paths.agentPath('code-reviewer', {} as never);
          return p ?? '';
        } catch {
          return '';
        }
      }
      return '';
    }
    case 'skills': {
      return layout.skillDir ? `${layout.skillDir}/api-generator/SKILL.md` : '';
    }
    default:
      // additionalRules, mcp, hooks, ignore, permissions — paths are
      // determined at generation time, not statically derivable from layout.
      // Leave blank for the seed script or manual research to fill.
      return '';
  }
}

function buildCell(
  target: string,
  feature: CapabilityFeatureKey,
  scope: TargetLayoutScope,
): LedgerCell {
  const caps = getTargetCapabilities(target, scope);
  const cap = caps?.[feature];
  const level = cap?.level ?? 'none';

  const path = level === 'none' || level === 'partial' ? '' : derivePath(target, feature, scope);
  const ext = path ? extname(path).toLowerCase() : '';

  return {
    target,
    feature,
    scope,
    maxAchievable: level,
    path,
    ext: ext || '',
    format: path ? formatForExt(ext) : 'json',
    fingerprint: {
      topLevelKeys: [],
      requiredFrontmatter: [],
      keyChecks: [],
    },
    source: [],
    verifiedAt: null,
    verdict: 'unverified',
    rejectionReason: null,
  };
}

function main(): void {
  const existingRaw = readFileSync(LEDGER_PATH, 'utf-8');
  const existing: { cells: LedgerCell[] } = JSON.parse(existingRaw);
  const existingMap = new Map<string, LedgerCell>();
  for (const cell of existing.cells) {
    existingMap.set(cellKey(cell.target, cell.feature, cell.scope), cell);
  }

  const cells: LedgerCell[] = [];

  for (const target of TARGET_IDS) {
    for (const scope of CAPABILITY_SCOPES) {
      const caps = getTargetCapabilities(target, scope);
      if (!caps && scope === 'global') continue;

      for (const feature of CAPABILITY_FEATURES) {
        const key = cellKey(target, feature, scope);
        const existingCell = existingMap.get(key);
        const newCell = buildCell(target, feature, scope);

        if (existingCell) {
          cells.push(mergeCell(existingCell, newCell));
        } else if (newCell.maxAchievable === 'native' || newCell.maxAchievable === 'embedded') {
          if (newCell.path) {
            cells.push(newCell);
          }
          // Skip native/embedded cells with no derivable path — they need
          // the seed script or manual research to attribute a file.
        } else {
          cells.push(newCell);
        }
      }
    }
  }

  cells.sort((a, b) => {
    const t = a.target.localeCompare(b.target);
    if (t !== 0) return t;
    const f = a.feature.localeCompare(b.feature);
    if (f !== 0) return f;
    return a.scope.localeCompare(b.scope);
  });

  writeFileSync(LEDGER_PATH, `${JSON.stringify({ cells }, null, 2)}\n`);
  process.stdout.write(`Wrote ${cells.length} cells (from ${existing.cells.length} existing)\n`);
}

main();
