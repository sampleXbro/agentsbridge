/**
 * Cursor settings import helpers — permissions, hooks, and ignore file processing.
 */

import { join, dirname } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { getHookCommand, getHookPrompt, hasHookText } from '../../core/hook-command.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { stringify as yamlStringify } from 'yaml';
import {
  CURSOR_SETTINGS,
  CURSOR_HOOKS,
  CURSOR_IGNORE,
  CURSOR_INDEXING_IGNORE,
  CURSOR_CANONICAL_PERMISSIONS,
  CURSOR_CANONICAL_HOOKS,
  CURSOR_CANONICAL_IGNORE,
} from './constants.js';

/**
 * Convert Cursor settings.json hooks to canonical hooks.yaml format.
 * Cursor uses same structure as Claude Code: { event: [{ matcher, hooks: [{ type, command }] }] }
 */
export function cursorHooksToCanonical(hooks: Record<string, unknown>): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    const canonical: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const matcher = typeof e.matcher === 'string' ? e.matcher : '';
      if (!matcher) continue;
      const hookList = Array.isArray(e.hooks) ? (e.hooks as Array<Record<string, unknown>>) : [];
      for (const hook of hookList) {
        const type = hook.type === 'prompt' ? 'prompt' : 'command';
        if (!hasHookText({ ...hook, type })) continue;
        const value =
          type === 'prompt'
            ? getHookPrompt(hook) || getHookCommand(hook)
            : getHookCommand(hook) || getHookPrompt(hook);
        const item: Record<string, unknown> = { matcher, type, command: value };
        if (typeof hook.timeout === 'number') item.timeout = hook.timeout;
        canonical.push(item);
      }
    }
    if (canonical.length > 0) result[event] = canonical;
  }
  return result;
}

export async function importSettings(projectRoot: string, results: ImportResult[]): Promise<void> {
  let hooksImportedFromHooksJson = false;
  const hooksJsonPath = join(projectRoot, CURSOR_HOOKS);
  const hooksJsonContent = await readFileSafe(hooksJsonPath);
  if (hooksJsonContent) {
    try {
      const hooksFile = JSON.parse(hooksJsonContent) as Record<string, unknown>;
      if (hooksFile.hooks && typeof hooksFile.hooks === 'object') {
        const canonical = cursorHooksToCanonical(hooksFile.hooks as Record<string, unknown>);
        if (Object.keys(canonical).length > 0) {
          const hooksContent = yamlStringify(canonical);
          const destPath = join(projectRoot, CURSOR_CANONICAL_HOOKS);
          await mkdirp(dirname(destPath));
          await writeFileAtomic(destPath, hooksContent);
          results.push({
            fromTool: 'cursor',
            fromPath: hooksJsonPath,
            toPath: CURSOR_CANONICAL_HOOKS,
            feature: 'hooks',
          });
          hooksImportedFromHooksJson = true;
        }
      }
    } catch {
      /* ignore parse errors */
    }
  }

  const settingsPath = join(projectRoot, CURSOR_SETTINGS);
  const content = await readFileSafe(settingsPath);
  if (!content) return;
  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return;
  }

  const rawPerms = settings.permissions;
  if (rawPerms && typeof rawPerms === 'object' && !Array.isArray(rawPerms)) {
    const perms = rawPerms as Record<string, unknown>;
    const allow = Array.isArray(perms.allow)
      ? (perms.allow as string[]).filter((s) => typeof s === 'string')
      : [];
    const deny = Array.isArray(perms.deny)
      ? (perms.deny as string[]).filter((s) => typeof s === 'string')
      : [];
    if (allow.length > 0 || deny.length > 0) {
      const permContent = yamlStringify({ allow, deny });
      const destPath = join(projectRoot, CURSOR_CANONICAL_PERMISSIONS);
      await mkdirp(dirname(destPath));
      await writeFileAtomic(destPath, permContent);
      results.push({
        fromTool: 'cursor',
        fromPath: settingsPath,
        toPath: CURSOR_CANONICAL_PERMISSIONS,
        feature: 'permissions',
      });
    }
  }

  const rawHooks = !hooksImportedFromHooksJson ? settings.hooks : undefined;
  if (rawHooks && typeof rawHooks === 'object' && !Array.isArray(rawHooks)) {
    const canonicalHooks = cursorHooksToCanonical(rawHooks as Record<string, unknown>);
    if (Object.keys(canonicalHooks).length > 0) {
      const hooksContent = yamlStringify(canonicalHooks);
      const destPath = join(projectRoot, CURSOR_CANONICAL_HOOKS);
      await mkdirp(dirname(destPath));
      await writeFileAtomic(destPath, hooksContent);
      results.push({
        fromTool: 'cursor',
        fromPath: settingsPath,
        toPath: CURSOR_CANONICAL_HOOKS,
        feature: 'hooks',
      });
    }
  }
}

export async function importIgnore(projectRoot: string, results: ImportResult[]): Promise<void> {
  const sources = [
    { path: join(projectRoot, CURSOR_IGNORE), label: CURSOR_IGNORE },
    { path: join(projectRoot, CURSOR_INDEXING_IGNORE), label: CURSOR_INDEXING_IGNORE },
  ];
  const patterns: string[] = [];
  const importedFrom: string[] = [];
  for (const source of sources) {
    const content = await readFileSafe(source.path);
    if (content === null) continue;
    importedFrom.push(source.label);
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !patterns.includes(trimmed)) {
        patterns.push(trimmed);
      }
    }
  }
  if (patterns.length === 0) return;
  const destPath = join(projectRoot, CURSOR_CANONICAL_IGNORE);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, patterns.join('\n') + '\n');
  results.push({
    fromTool: 'cursor',
    fromPath: join(projectRoot, importedFrom[0]!),
    toPath: CURSOR_CANONICAL_IGNORE,
    feature: 'ignore',
  });
}
