/**
 * AugmentCode settings.json import helpers.
 *
 * AugmentCode stores MCP, hooks, and permissions all in `.augment/settings.json`
 * (or the global `~/.augment/settings.json`). This module extracts each feature
 * into canonical form.
 *
 * settings.json shape:
 *   {
 *     "mcpServers": { ... },
 *     "hooks": {
 *       "PreToolUse": [{ "matcher": "...", "hooks": [{ "type": "command", "command": "..." }] }],
 *       ...
 *     },
 *     "toolPermissions": [{ "toolName": "...", "permission": { "type": "allow|deny|ask-user" } }]
 *   }
 */

import { join, dirname } from 'node:path';
import type { ImportResult, McpServer } from '../../core/types.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { writeMcpWithMerge } from '../import/mcp-merge.js';
import { stringify as yamlStringify } from 'yaml';
import {
  AUGMENT_CODE_TARGET,
  AUGMENT_CODE_CANONICAL_MCP,
  AUGMENT_CODE_CANONICAL_HOOKS,
  AUGMENT_CODE_CANONICAL_IGNORE,
} from './constants.js';

/**
 * Convert AugmentCode settings.json hooks format to canonical hooks.yaml format.
 * AugmentCode: { event: [{ matcher, hooks: [{ type, command, timeout }] }] }
 * Canonical:   { event: [{ matcher, command, timeout }] }
 */
function augmentHooksToCanonical(hooks: Record<string, unknown>): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    const canonical: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const matcher = typeof e.matcher === 'string' ? e.matcher : '.*';
      const hookList = Array.isArray(e.hooks) ? (e.hooks as Array<Record<string, unknown>>) : [];
      for (const hook of hookList) {
        const command = typeof hook.command === 'string' ? hook.command : undefined;
        if (!command) continue;
        const item: Record<string, unknown> = { matcher, type: 'command', command };
        if (typeof hook.timeout === 'number') item.timeout = hook.timeout;
        canonical.push(item);
      }
    }
    if (canonical.length > 0) result[event] = canonical;
  }
  return result;
}

/**
 * Import MCP, hooks, and permissions from `.augment/settings.json`.
 */
export async function importAugmentSettings(
  projectRoot: string,
  settingsPath: string,
  results: ImportResult[],
): Promise<void> {
  const content = await readFileSafe(join(projectRoot, settingsPath));
  if (content === null) return;

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return;
  }

  // MCP servers
  if (settings.mcpServers && typeof settings.mcpServers === 'object') {
    const servers = settings.mcpServers as Record<string, McpServer>;
    await writeMcpWithMerge(projectRoot, AUGMENT_CODE_CANONICAL_MCP, servers);
    results.push({
      fromTool: AUGMENT_CODE_TARGET,
      fromPath: join(projectRoot, settingsPath),
      toPath: AUGMENT_CODE_CANONICAL_MCP,
      feature: 'mcp',
    });
  }

  // Hooks
  const rawHooks = settings.hooks;
  if (rawHooks && typeof rawHooks === 'object' && !Array.isArray(rawHooks)) {
    const canonicalHooks = augmentHooksToCanonical(rawHooks as Record<string, unknown>);
    if (Object.keys(canonicalHooks).length > 0) {
      const destPath = join(projectRoot, AUGMENT_CODE_CANONICAL_HOOKS);
      await mkdirp(dirname(destPath));
      await writeFileAtomic(destPath, yamlStringify(canonicalHooks));
      results.push({
        fromTool: AUGMENT_CODE_TARGET,
        fromPath: join(projectRoot, settingsPath),
        toPath: AUGMENT_CODE_CANONICAL_HOOKS,
        feature: 'hooks',
      });
    }
  }
}

/**
 * Import `.augmentignore` into canonical ignore.
 */
export async function importAugmentIgnore(
  projectRoot: string,
  ignorePath: string,
  results: ImportResult[],
): Promise<void> {
  const content = await readFileSafe(join(projectRoot, ignorePath));
  if (content === null) return;

  const patterns = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  if (patterns.length === 0) return;

  const destPath = join(projectRoot, AUGMENT_CODE_CANONICAL_IGNORE);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, patterns.join('\n'));
  results.push({
    fromTool: AUGMENT_CODE_TARGET,
    fromPath: join(projectRoot, ignorePath),
    toPath: AUGMENT_CODE_CANONICAL_IGNORE,
    feature: 'ignore',
  });
}
