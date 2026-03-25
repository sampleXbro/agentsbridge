/**
 * Lock file management for team collaboration.
 * Tracks checksums of canonical source files.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { join, relative } from 'node:path';
import { readFileSafe, writeFileAtomic, readDirRecursive, exists } from '../utils/fs.js';
import { hashFile, hashContent } from '../utils/hash.js';
import type { LockFile } from '../core/types.js';
import { listPacks } from '../install/pack-reader.js';

const LOCK_FILENAME = '.lock';

/** Paths/patterns for canonical files, relative to .agentsbridge */
const CANONICAL_PATTERNS = [
  (r: string) => r.startsWith('rules/') && r.endsWith('.md'),
  (r: string) => r.startsWith('commands/') && r.endsWith('.md'),
  (r: string) => r.startsWith('agents/') && r.endsWith('.md'),
  (r: string) => r.match(/^skills\/[^/]+\/.+$/) !== null,
  (r: string) => r === 'mcp.json',
  (r: string) => r === 'permissions.yaml',
  (r: string) => r === 'hooks.yaml',
  (r: string) => r === 'ignore',
];

function isCanonical(relPath: string): boolean {
  if (relPath.startsWith('packs/')) return false; // tracked separately
  return CANONICAL_PATTERNS.some((p) => p(relPath));
}

const FEATURE_PATTERNS: Record<string, (path: string) => boolean> = {
  rules: (path) => path.startsWith('rules/'),
  commands: (path) => path.startsWith('commands/'),
  agents: (path) => path.startsWith('agents/'),
  skills: (path) => /^skills\/[^/]+\/.+$/.test(path),
  mcp: (path) => path === 'mcp.json',
  permissions: (path) => path === 'permissions.yaml',
  hooks: (path) => path === 'hooks.yaml',
  ignore: (path) => path === 'ignore',
};

/**
 * Read lock file from .agentsbridge directory.
 * @param abDir - Absolute path to .agentsbridge
 * @returns Parsed LockFile or null if missing
 */
export async function readLock(abDir: string): Promise<LockFile | null> {
  const lockPath = join(abDir, LOCK_FILENAME);
  const content = await readFileSafe(lockPath);
  if (content === null) return null;

  try {
    const raw = parseYaml(content) as {
      generated_at?: string;
      generated_by?: string;
      lib_version?: string;
      checksums?: Record<string, string>;
      extends?: Record<string, string>;
      packs?: Record<string, string>;
    };
    if (!raw || typeof raw !== 'object') return null;
    return {
      generatedAt: String(raw.generated_at ?? ''),
      generatedBy: String(raw.generated_by ?? ''),
      libVersion: String(raw.lib_version ?? ''),
      checksums: raw.checksums && typeof raw.checksums === 'object' ? raw.checksums : {},
      extends: raw.extends && typeof raw.extends === 'object' ? raw.extends : {},
      packs: raw.packs && typeof raw.packs === 'object' ? raw.packs : {},
    };
  } catch {
    return null;
  }
}

/**
 * Write lock file to .agentsbridge directory.
 * @param abDir - Absolute path to .agentsbridge
 * @param lock - Lock file data
 */
export async function writeLock(abDir: string, lock: LockFile): Promise<void> {
  const lockPath = join(abDir, LOCK_FILENAME);
  const raw = {
    generated_at: lock.generatedAt,
    generated_by: lock.generatedBy,
    lib_version: lock.libVersion,
    checksums: lock.checksums,
    extends: lock.extends,
    packs: lock.packs,
  };
  const content =
    '# Auto-generated. DO NOT EDIT MANUALLY.\n# Tracks the state of all config files for team conflict resolution.\n\n' +
    stringifyYaml(raw);
  await writeFileAtomic(lockPath, content);
}

/**
 * Build checksums of all canonical files in .agentsbridge.
 * Paths in result are relative to .agentsbridge (e.g. rules/_root.md).
 * @param abDir - Absolute path to .agentsbridge
 * @returns Record of relative path -> sha256:hex
 */
export async function buildChecksums(abDir: string): Promise<Record<string, string>> {
  if (!(await exists(abDir))) return {};
  const files = await readDirRecursive(abDir);
  const result: Record<string, string> = {};

  for (const fullPath of files) {
    const rel = relative(abDir, fullPath).replace(/\\/g, '/');
    if (rel === LOCK_FILENAME) continue;
    if (!isCanonical(rel)) continue;

    const h = await hashFile(fullPath);
    if (h !== null) {
      result[rel] = h.startsWith('sha256:') ? h : `sha256:${h}`;
    }
  }
  return result;
}

export function detectLockedFeatureViolations(
  lockChecksums: Record<string, string>,
  currentChecksums: Record<string, string>,
  lockFeatures: string[],
): string[] {
  if (lockFeatures.length === 0) return [];

  const matchers = lockFeatures
    .map((feature) => FEATURE_PATTERNS[feature])
    .filter((matcher): matcher is (path: string) => boolean => matcher !== undefined);

  if (matchers.length === 0) return [];

  const allPaths = new Set([...Object.keys(lockChecksums), ...Object.keys(currentChecksums)]);
  const violations: string[] = [];

  for (const path of allPaths) {
    if (!matchers.some((matcher) => matcher(path))) continue;
    if (lockChecksums[path] !== currentChecksums[path]) violations.push(path);
  }

  return violations;
}

/**
 * Build pack checksums from a packs directory.
 * Returns pack-name → content_hash from each pack's pack.yaml.
 * @param packsDir - Absolute path to .agentsbridge/packs/
 */
export async function buildPackChecksums(packsDir: string): Promise<Record<string, string>> {
  const packs = await listPacks(packsDir);
  const result: Record<string, string> = {};
  for (const { meta } of packs) {
    result[meta.name] = meta.content_hash;
  }
  return result;
}

/** Resolved extend for checksum/version building in lock */
export interface ResolvedExtendForLock {
  name: string;
  resolvedPath: string;
  /** Resolved version for remote extends. Store as-is in lock. */
  version?: string;
}

/**
 * Build extend entries for lock. Remote: store version. Local: store local:sha256:hex.
 * @param resolvedExtends - Resolved extend paths (with optional version for remote)
 * @returns Record of extend name -> version string or local:sha256:hex
 */
export async function buildExtendChecksums(
  resolvedExtends: ResolvedExtendForLock[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const ext of resolvedExtends) {
    if (ext.version !== undefined) {
      result[ext.name] = ext.version;
      continue;
    }
    const abDir = join(ext.resolvedPath, '.agentsbridge');
    const checksums = await buildChecksums(abDir);
    const fingerprint = Object.keys(checksums)
      .sort()
      .map((p) => `${p}:${checksums[p]}`)
      .join('\n');
    const h = hashContent(fingerprint);
    const hex = h.startsWith('sha256:') ? h : `sha256:${h}`;
    result[ext.name] = `local:${hex}`;
  }
  return result;
}
