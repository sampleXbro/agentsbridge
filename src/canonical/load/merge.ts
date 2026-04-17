/**
 * Merge canonical files from extends with local. Overlay wins on same-name conflict.
 */

import { basename } from 'node:path';
import type {
  CanonicalFiles,
  CanonicalRule,
  McpConfig,
  Permissions,
  Hooks,
} from '../../core/types.js';

function ruleSlug(r: CanonicalRule): string {
  return basename(r.source, '.md');
}

/**
 * Merge overlay onto base. Overlay wins on same-name conflict for rules, commands, agents, skills.
 * MCP: overlay servers merge, overlay wins same-name. Permissions: union; local deny wins.
 *
 * @param base - Base canonical files (earlier in merge order)
 * @param overlay - Overlay canonical files (later, wins on conflict)
 * @returns Merged CanonicalFiles
 */
export function mergeCanonicalFiles(base: CanonicalFiles, overlay: CanonicalFiles): CanonicalFiles {
  const baseRuleMap = new Map(base.rules.map((r) => [ruleSlug(r), r]));
  for (const r of overlay.rules) {
    baseRuleMap.set(ruleSlug(r), r);
  }

  const baseCmdMap = new Map(base.commands.map((c) => [c.name, c]));
  for (const c of overlay.commands) {
    baseCmdMap.set(c.name, c);
  }

  const baseAgentMap = new Map(base.agents.map((a) => [a.name, a]));
  for (const a of overlay.agents) {
    baseAgentMap.set(a.name, a);
  }

  const baseSkillMap = new Map(base.skills.map((s) => [s.name, s]));
  for (const s of overlay.skills) {
    baseSkillMap.set(s.name, s);
  }

  const mcp: McpConfig | null = mergeMcp(base.mcp, overlay.mcp);
  const permissions: Permissions | null = mergePermissions(base.permissions, overlay.permissions);
  const hooks: Hooks | null = mergeHooks(base.hooks, overlay.hooks);
  const ignore = mergeIgnore(base.ignore, overlay.ignore);

  return {
    rules: Array.from(baseRuleMap.values()),
    commands: Array.from(baseCmdMap.values()),
    agents: Array.from(baseAgentMap.values()),
    skills: Array.from(baseSkillMap.values()),
    mcp,
    permissions,
    hooks,
    ignore,
  };
}

function mergeMcp(base: McpConfig | null, overlay: McpConfig | null): McpConfig | null {
  if (!base && !overlay) return null;
  const baseServers = base?.mcpServers ?? {};
  const overlayServers = overlay?.mcpServers ?? {};
  return {
    mcpServers: { ...baseServers, ...overlayServers },
  };
}

function mergePermissions(
  base: Permissions | null,
  overlay: Permissions | null,
): Permissions | null {
  if (!base && !overlay) return null;
  const allow = mergeUniqueStrings(base?.allow ?? [], overlay?.allow ?? []);
  const deny = mergeUniqueStrings(base?.deny ?? [], overlay?.deny ?? []);
  const ask = mergeUniqueStrings(base?.ask ?? [], overlay?.ask ?? []);
  return { allow, deny, ask };
}

function mergeUniqueStrings(base: string[], overlay: string[]): string[] {
  const seen = new Set(base);
  const merged = [...base];
  for (const value of overlay) {
    if (!seen.has(value)) {
      seen.add(value);
      merged.push(value);
    }
  }
  return merged;
}

function mergeHooks(base: Hooks | null, overlay: Hooks | null): Hooks | null {
  if (!base && !overlay) return null;
  const result: Hooks = {};
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(overlay ?? {})]) as Set<
    keyof Hooks
  >;
  for (const k of keys) {
    const o = overlay?.[k];
    const b = base?.[k];
    result[k] = o !== undefined && o.length > 0 ? o : (b ?? []);
  }
  return result;
}

function mergeIgnore(base: string[], overlay: string[]): string[] {
  const seen = new Set(base);
  const out = [...base];
  for (const p of overlay) {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}
