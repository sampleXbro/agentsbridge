/**
 * Claude Code settings import helpers — MCP, permissions, and hooks processing.
 */

import { join, dirname } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { getHookCommand, getHookPrompt, hasHookText } from '../../core/hook-command.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/fs.js';
import { stringify as yamlStringify } from 'yaml';

const CLAUDE_SETTINGS = '.claude/settings.json';
const CLAUDE_MCP_JSON = '.mcp.json';
const AB_MCP = '.agentsmesh/mcp.json';
const AB_PERMISSIONS = '.agentsmesh/permissions.yaml';
const AB_HOOKS = '.agentsmesh/hooks.yaml';

/**
 * Convert Claude Code settings.json hooks format to canonical hooks.yaml format.
 * Claude Code: { event: [{ matcher, hooks: [{ type, command, timeout }] }] }
 * Canonical: { event: [{ matcher, command, timeout }] }
 */
export function claudeHooksToCanonical(hooks: Record<string, unknown>): Record<string, unknown[]> {
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

export async function importMcpJson(projectRoot: string, results: ImportResult[]): Promise<void> {
  const mcpPath = join(projectRoot, CLAUDE_MCP_JSON);
  const content = await readFileSafe(mcpPath);
  if (content === null) return;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return;
  }

  if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
    const mcpContent = JSON.stringify({ mcpServers: parsed.mcpServers }, null, 2);
    const destPath = join(projectRoot, AB_MCP);
    await mkdirp(dirname(destPath));
    await writeFileAtomic(destPath, mcpContent);
    results.push({
      fromTool: 'claude-code',
      fromPath: mcpPath,
      toPath: AB_MCP,
      feature: 'mcp',
    });
  }
}

export async function importSettings(projectRoot: string, results: ImportResult[]): Promise<void> {
  const settingsPath = join(projectRoot, CLAUDE_SETTINGS);
  const content = await readFileSafe(settingsPath);
  if (!content) return;

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return;
  }

  const alreadyImportedMcp = results.some((r) => r.feature === 'mcp');
  if (!alreadyImportedMcp && settings.mcpServers && typeof settings.mcpServers === 'object') {
    const mcpContent = JSON.stringify({ mcpServers: settings.mcpServers }, null, 2);
    const destPath = join(projectRoot, AB_MCP);
    await mkdirp(dirname(destPath));
    await writeFileAtomic(destPath, mcpContent);
    results.push({
      fromTool: 'claude-code',
      fromPath: settingsPath,
      toPath: AB_MCP,
      feature: 'mcp',
    });
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
      const destPath = join(projectRoot, AB_PERMISSIONS);
      await mkdirp(dirname(destPath));
      await writeFileAtomic(destPath, permContent);
      results.push({
        fromTool: 'claude-code',
        fromPath: settingsPath,
        toPath: AB_PERMISSIONS,
        feature: 'permissions',
      });
    }
  }

  const rawHooks = settings.hooks;
  if (rawHooks && typeof rawHooks === 'object' && !Array.isArray(rawHooks)) {
    const canonicalHooks = claudeHooksToCanonical(rawHooks as Record<string, unknown>);
    if (Object.keys(canonicalHooks).length > 0) {
      const hooksContent = yamlStringify(canonicalHooks);
      const destPath = join(projectRoot, AB_HOOKS);
      await mkdirp(dirname(destPath));
      await writeFileAtomic(destPath, hooksContent);
      results.push({
        fromTool: 'claude-code',
        fromPath: settingsPath,
        toPath: AB_HOOKS,
        feature: 'hooks',
      });
    }
  }
}
