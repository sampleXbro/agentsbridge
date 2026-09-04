/**
 * Import `~/.kimi-code/config.toml` (global scope only) into canonical hooks
 * and permissions.
 *
 * Both writes are narrow, because canonical is shared with every other target:
 *
 *  - nothing is written unless the config actually carries that key, so an
 *    unparsable file or one with no `[[hooks]]` / `[[permission.rules]]` never
 *    clears canonical content another target still needs;
 *  - both features merge key-scoped, so the canonical entries Kimi Code cannot
 *    express — unsupported hook events, prompt-type hooks, unparseable
 *    permission patterns — plus the file's comments and key order survive.
 */

import { dirname, join } from 'node:path';
import { Document, parseDocument, isMap } from 'yaml';
import type { ImportResult, Permissions } from '../../core/types.js';
import { mkdirp, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseKimiConfig } from './config-toml.js';
import { isValidKimiPermissionPattern, type KimiPermissionDecision } from './permissions-format.js';
import { mergeCanonicalHooks, serializeCanonicalHooks, toCanonicalHooks } from './hooks-import.js';
import {
  KIMI_CODE_TARGET,
  KIMI_CODE_GLOBAL_CONFIG_FILE,
  KIMI_CODE_CANONICAL_HOOKS,
  KIMI_CODE_CANONICAL_PERMISSIONS,
} from './constants.js';

const DECISION_TO_LIST: Record<KimiPermissionDecision, keyof Permissions> = {
  allow: 'allow',
  deny: 'deny',
  ask: 'ask',
};

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toCanonicalPermissions(
  rules: readonly Record<string, unknown>[],
): Partial<Record<keyof Permissions, string[]>> {
  const lists: Partial<Record<keyof Permissions, string[]>> = {};
  for (const rule of rules) {
    const decision = str(rule.decision);
    const pattern = str(rule.pattern);
    if (!pattern || decision === undefined || !(decision in DECISION_TO_LIST)) continue;
    const key = DECISION_TO_LIST[decision as KimiPermissionDecision];
    (lists[key] ??= []).push(pattern);
  }
  return lists;
}

/** The canonical file as an editable document; comments and key order survive. */
function canonicalDocument(content: string | null): Document {
  if (content !== null) {
    const doc = parseDocument(content);
    if (doc.errors.length === 0 && (doc.contents === null || isMap(doc.contents))) return doc;
  }
  return new Document({});
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

/** Replace what Kimi Code expresses; keep canonical entries it cannot. */
function mergeList(existing: unknown, imported: string[]): string[] {
  const preserved = stringList(existing).filter(
    (pattern) => !isValidKimiPermissionPattern(pattern) && !imported.includes(pattern),
  );
  return [...imported, ...preserved];
}

async function importHooks(
  projectRoot: string,
  entries: readonly Record<string, unknown>[],
  results: ImportResult[],
): Promise<void> {
  const imported = toCanonicalHooks(entries);
  if (Object.keys(imported).length === 0) return;
  const destPath = join(projectRoot, KIMI_CODE_CANONICAL_HOOKS);
  const merged = mergeCanonicalHooks(await readFileSafe(destPath), imported);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, serializeCanonicalHooks(merged));
  results.push({
    fromTool: KIMI_CODE_TARGET,
    fromPath: join(projectRoot, KIMI_CODE_GLOBAL_CONFIG_FILE),
    toPath: KIMI_CODE_CANONICAL_HOOKS,
    feature: 'hooks',
  });
}

async function importPermissions(
  projectRoot: string,
  rules: readonly Record<string, unknown>[],
  results: ImportResult[],
): Promise<void> {
  const lists = toCanonicalPermissions(rules);
  if (Object.keys(lists).length === 0) return;

  const destPath = join(projectRoot, KIMI_CODE_CANONICAL_PERMISSIONS);
  const doc = canonicalDocument(await readFileSafe(destPath));
  const existing = (doc.toJS() ?? {}) as Record<string, unknown>;
  for (const [key, imported] of Object.entries(lists)) {
    doc.set(key, mergeList(existing[key], imported));
  }

  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, doc.toString().trimEnd() + '\n');
  results.push({
    fromTool: KIMI_CODE_TARGET,
    fromPath: join(projectRoot, KIMI_CODE_GLOBAL_CONFIG_FILE),
    toPath: KIMI_CODE_CANONICAL_PERMISSIONS,
    feature: 'permissions',
  });
}

export async function importKimiCodeConfig(
  projectRoot: string,
  results: ImportResult[],
): Promise<void> {
  const content = await readFileSafe(join(projectRoot, KIMI_CODE_GLOBAL_CONFIG_FILE));
  if (content === null) return;
  const { hooks, permissionRules } = parseKimiConfig(content);
  await importHooks(projectRoot, hooks, results);
  await importPermissions(projectRoot, permissionRules, results);
}
