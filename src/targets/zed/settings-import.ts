/**
 * Import the ignore and permission halves of Zed's `settings.json`.
 *
 * Both merges are ADDITIVE. Every other target reads the same
 * `.agentsmesh/ignore` and `.agentsmesh/permissions.yaml`, and a Zed
 * `settings.json` is the user's editor config — routinely holding one exclusion
 * or one hand-configured tool and nothing else. Treating that as authoritative
 * for the whole canonical file deletes entries belonging to claude-code, cursor
 * and the rest, so import only ever adds what Zed says on top of what is there.
 * MCP import is additive for the same reason (`writeMcpWithMerge`).
 */

import { join, dirname } from 'node:path';
import { Document, parseDocument, isMap } from 'yaml';
import type { ImportResult, Permissions } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { mkdirp, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseZedIgnoreGlobs, mergeCanonicalIgnore } from './ignore-settings.js';
import { parseZedPermissions } from './permissions-settings.js';
import { parseZedSettings } from './settings-overlay.js';
import { ZED_TARGET, ZED_CANONICAL_IGNORE, ZED_CANONICAL_PERMISSIONS } from './constants.js';

async function importIgnore(
  projectRoot: string,
  settings: Record<string, unknown>,
  settingsPath: string,
  results: ImportResult[],
): Promise<void> {
  const globs = parseZedIgnoreGlobs(settings);
  if (globs.length === 0) return;

  const destPath = join(projectRoot, ZED_CANONICAL_IGNORE);
  const content = mergeCanonicalIgnore(await readFileSafe(destPath), globs);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, content);
  results.push({
    fromTool: ZED_TARGET,
    fromPath: settingsPath,
    toPath: ZED_CANONICAL_IGNORE,
    feature: 'ignore',
  });
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
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/** Keep every canonical entry, then append the ones Zed adds. */
function mergeList(existing: unknown, imported: readonly string[]): string[] {
  const kept = stringList(existing);
  return [...kept, ...imported.filter((pattern) => !kept.includes(pattern))];
}

async function importPermissions(
  projectRoot: string,
  settings: Record<string, unknown>,
  settingsPath: string,
  results: ImportResult[],
): Promise<void> {
  const permissions: Permissions | null = parseZedPermissions(settings);
  if (permissions === null) return;

  const destPath = join(projectRoot, ZED_CANONICAL_PERMISSIONS);
  const doc = canonicalDocument(await readFileSafe(destPath));
  const existing = (doc.toJS() ?? {}) as Record<string, unknown>;
  doc.set('allow', mergeList(existing.allow, permissions.allow));
  doc.set('deny', mergeList(existing.deny, permissions.deny));
  doc.set('ask', mergeList(existing.ask, permissions.ask ?? []));

  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, doc.toString().trimEnd() + '\n');
  results.push({
    fromTool: ZED_TARGET,
    fromPath: settingsPath,
    toPath: ZED_CANONICAL_PERMISSIONS,
    feature: 'permissions',
  });
}

/**
 * @param scope - `agent.tool_permissions` only exists in user settings, so
 *   permissions are read in global scope alone.
 */
export async function importZedSettingsFeatures(
  projectRoot: string,
  settingsPath: string,
  scope: TargetLayoutScope,
  results: ImportResult[],
): Promise<void> {
  const settings = parseZedSettings(await readFileSafe(join(projectRoot, settingsPath)));
  if (settings === null) return;

  await importIgnore(projectRoot, settings, settingsPath, results);
  if (scope === 'global') {
    await importPermissions(projectRoot, settings, settingsPath, results);
  }
}
