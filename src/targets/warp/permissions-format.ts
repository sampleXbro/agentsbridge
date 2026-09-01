/**
 * Canonical permissions <-> Warp `~/.warp/settings.toml` `[agents.profiles]`.
 *
 * Keys (docs.warp.dev/terminal/settings and .../settings/all-settings):
 *   - `agent_mode_command_execution_allowlist` — regex patterns, auto-run
 *   - `agent_mode_command_execution_denylist`  — regex patterns, always blocked
 *   - `agent_mode_coding_file_read_allowlist`  — readable file paths
 *   - `agent_mode_coding_permissions`          — `always_ask_before_reading` |
 *     `always_allow_reading` | `allow_reading_specific_files`
 *
 * Those four keys are OWNED: every emit rewrites them from canonical, so
 * revoking a permission actually clears it. Every other key — including
 * siblings inside `[agents]` and `[agents.profiles]`, and the blanket
 * `agent_mode_execute_readonly_commands` toggle — belongs to the user and is
 * never touched. An owned key with an empty projection is removed when removal
 * is the narrower outcome: Warp's documented defaults are a protective
 * denylist, an empty read allowlist and `always_ask_before_reading`. The
 * command allowlist is the exception — its default auto-runs `cat`/`ls`/... —
 * so "canonical grants nothing" is written as an explicit empty list, unless
 * the file holds no owned key yet (see `serializeWarpSettings`).
 *
 * Canonical `ask` entries are NOT dropped: Warp asks for anything in neither
 * list, so leaving them out is the projection. Entries with no Warp key at all
 * (bare `Bash`, `Edit(...)`, denied reads, payloads that are not valid regexes)
 * are reported by `lintPermissions` — see `unmappedPermissionEntries` and
 * `regexInterpretedEntries`.
 */

import type { Permissions } from '../../core/types.js';
import {
  commandRegex,
  commandPattern,
  isRegexPayload,
  type WarpCommandList,
} from './permissions-regex.js';

const READ_ALL = 'always_allow_reading';
const READ_SPECIFIC = 'allow_reading_specific_files';

/** `[agents.profiles]` keys agentsmesh rewrites from canonical on every emit. */
export const OWNED_PROFILE_KEYS = [
  'agent_mode_command_execution_allowlist',
  'agent_mode_command_execution_denylist',
  'agent_mode_coding_file_read_allowlist',
  'agent_mode_coding_permissions',
] as const;

export interface WarpAgentProfile {
  agent_mode_command_execution_allowlist?: string[];
  agent_mode_command_execution_denylist?: string[];
  agent_mode_coding_file_read_allowlist?: string[];
  agent_mode_coding_permissions?: string;
}

export interface UnmappedPermissions {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
}

/** `Read(./src/**)` -> `./src/**`. */
function readTarget(pattern: string): string | null {
  const match = /^Read\((.*)\)$/s.exec(pattern.trim());
  const target = match?.[1]?.trim();
  return target ? target : null;
}

/** True when the canonical entry lands in a `[agents.profiles]` key. */
export function mapsToWarpKey(pattern: string, list: WarpCommandList): boolean {
  if (commandRegex(pattern, list) !== null) return true;
  if (list === 'deny') return false;
  return pattern.trim() === 'Read' || readTarget(pattern) !== null;
}

function uniqueRegexes(patterns: readonly string[], list: WarpCommandList): string[] {
  const out: string[] = [];
  for (const pattern of patterns) {
    const regex = commandRegex(pattern, list);
    if (regex !== null && !out.includes(regex)) out.push(regex);
  }
  return out;
}

function filterLists(
  permissions: Permissions | null,
  keep: (pattern: string, list: WarpCommandList) => boolean,
): UnmappedPermissions {
  return {
    allow: (permissions?.allow ?? []).filter((pattern) => keep(pattern, 'allow')),
    deny: (permissions?.deny ?? []).filter((pattern) => keep(pattern, 'deny')),
  };
}

/** Canonical entries with no `[agents.profiles]` key, grouped by list. */
export function unmappedPermissionEntries(permissions: Permissions | null): UnmappedPermissions {
  return filterLists(permissions, (pattern, list) => !mapsToWarpKey(pattern, list));
}

/** Mapped command entries whose payload Warp matches as a regex, not a literal. */
export function regexInterpretedEntries(permissions: Permissions | null): UnmappedPermissions {
  return filterLists(
    permissions,
    (pattern, list) => mapsToWarpKey(pattern, list) && isRegexPayload(pattern),
  );
}

/** The owned keys canonical permissions determine; `null` when there are none. */
export function buildWarpAgentProfile(permissions: Permissions | null): WarpAgentProfile | null {
  if (permissions === null) return null;

  const denylist = uniqueRegexes(permissions.deny, 'deny');
  const readAllowlist: string[] = [];
  let readAll = false;
  for (const pattern of permissions.allow) {
    if (pattern.trim() === 'Read') readAll = true;
    const target = readTarget(pattern);
    if (target !== null && !readAllowlist.includes(target)) readAllowlist.push(target);
  }

  const profile: WarpAgentProfile = {
    agent_mode_command_execution_allowlist: uniqueRegexes(permissions.allow, 'allow'),
  };
  if (denylist.length > 0) profile.agent_mode_command_execution_denylist = denylist;
  if (readAllowlist.length > 0) profile.agent_mode_coding_file_read_allowlist = readAllowlist;
  if (readAll) profile.agent_mode_coding_permissions = READ_ALL;
  else if (readAllowlist.length > 0) profile.agent_mode_coding_permissions = READ_SPECIFIC;

  return profile;
}

function stringEntries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function collectCommands(value: unknown, list: WarpCommandList, out: string[]): void {
  for (const regex of stringEntries(value)) {
    const pattern = commandPattern(regex, list);
    if (pattern !== null && !out.includes(pattern)) out.push(pattern);
  }
}

/** A parsed `[agents.profiles]` table back to canonical permissions. */
export function profileToPermissions(profiles: Record<string, unknown>): Permissions | null {
  const allow: string[] = [];
  collectCommands(profiles.agent_mode_command_execution_allowlist, 'allow', allow);
  if (profiles.agent_mode_coding_permissions === READ_ALL) allow.push('Read');
  for (const target of stringEntries(profiles.agent_mode_coding_file_read_allowlist)) {
    const pattern = `Read(${target})`;
    if (!allow.includes(pattern)) allow.push(pattern);
  }

  const deny: string[] = [];
  collectCommands(profiles.agent_mode_command_execution_denylist, 'deny', deny);

  if (allow.length === 0 && deny.length === 0) return null;
  return { allow, deny };
}
