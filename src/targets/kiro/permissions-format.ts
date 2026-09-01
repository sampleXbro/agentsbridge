/**
 * One canonical permission entry <-> one Kiro permission rule.
 *
 * kiro.dev/docs/permissions: a rule is `{capability, match, exclude, effect}`,
 * `match`/`exclude` are LISTS of patterns, and `effect` is `allow | ask | deny`
 * — so canonical's three lists map straight onto `effect`. Rules are evaluated
 * with a "deny-overrides algorithm: deny > ask > allow", so rule order carries
 * no meaning; the order the list builders use is fixed only to keep output
 * deterministic.
 *
 * Pattern support is per capability. `fs_read`/`fs_write` take filesystem globs
 * (`*` within a path component, `**` across separators) and `shell` takes
 * command patterns where "`*` matches any sequence of characters" — the docs'
 * own example is `npm *`. Every other capability (`web_fetch`, `subagent`, …)
 * gets a bare rule; a canonical entry that carries a payload for one of those
 * maps to nothing rather than being widened to the whole capability. `exclude`
 * has no canonical equivalent and is never emitted.
 */

export type KiroEffect = 'allow' | 'ask' | 'deny';

export interface KiroPermissionRule {
  capability: string;
  match?: string[];
  effect: KiroEffect;
}

export const KIRO_EFFECTS: readonly KiroEffect[] = ['deny', 'ask', 'allow'];

const CAPABILITY_BY_TOOL: ReadonlyMap<string, string> = new Map([
  ['Read', 'fs_read'],
  ['Grep', 'fs_read'],
  ['Glob', 'fs_read'],
  ['LS', 'fs_read'],
  ['Write', 'fs_write'],
  ['Edit', 'fs_write'],
  ['MultiEdit', 'fs_write'],
  ['NotebookEdit', 'fs_write'],
  ['Bash', 'shell'],
  ['WebFetch', 'web_fetch'],
  ['WebSearch', 'web_search'],
  ['Task', 'subagent'],
  ['Skill', 'skill'],
]);

/** Canonical spelling a capability is written back as when import has no better one. */
const TOOL_BY_CAPABILITY: ReadonlyMap<string, string> = new Map([
  ['fs_read', 'Read'],
  ['fs_write', 'Write'],
  ['shell', 'Bash'],
  ['web_fetch', 'WebFetch'],
  ['web_search', 'WebSearch'],
  ['subagent', 'Task'],
  ['skill', 'Skill'],
]);

/** Capabilities whose `match` list accepts a canonical payload. */
const PATTERN_CAPABILITIES: ReadonlySet<string> = new Set(['fs_read', 'fs_write', 'shell']);

const ENTRY = /^([A-Za-z][A-Za-z0-9_-]*)(?:\((.*)\))?$/s;

function splitEntry(entry: string): { tool: string; payload: string | null } | null {
  const match = ENTRY.exec(entry.trim());
  if (!match) return null;
  return { tool: match[1]!, payload: match[2] === undefined ? null : match[2].trim() };
}

/**
 * `npm run test:*` -> `npm run test*`: Kiro shell `*` already means "any
 * sequence". The prefix is kept byte for byte — trimming it would turn the
 * docs' own `npm *` (prefix `npm `, a whole word) into `npm*`, which also
 * matches `npmx`.
 */
function shellPattern(payload: string): string {
  return payload.endsWith(':*') ? `${payload.slice(0, -2)}*` : payload;
}

/** Exact inverse of `shellPattern`, so a rule reads back as the same prefix. */
function canonicalShellPayload(pattern: string): string {
  return pattern.length > 1 && pattern.endsWith('*') ? `${pattern.slice(0, -1)}:*` : pattern;
}

/** One canonical entry as a Kiro rule; `null` when Kiro cannot express it. */
export function toKiroRule(entry: string, effect: KiroEffect): KiroPermissionRule | null {
  const parsed = splitEntry(entry);
  if (!parsed) return null;
  const capability = CAPABILITY_BY_TOOL.get(parsed.tool);
  if (!capability) return null;
  if (parsed.payload === null) return { capability, effect };
  if (!PATTERN_CAPABILITIES.has(capability)) return null;
  const pattern = capability === 'shell' ? shellPattern(parsed.payload) : parsed.payload;
  return pattern === '' ? null : { capability, match: [pattern], effect };
}

/** Identity of a rule, used to dedupe emitted rules and to match imported ones back. */
export function kiroRuleKey(rule: KiroPermissionRule): string {
  return `${rule.effect}|${rule.capability}|${(rule.match ?? []).join(' ')}`;
}

/** Canonical entries for one Kiro rule; empty when canonical cannot express it. */
export function ruleToCanonicalEntries(rule: KiroPermissionRule): string[] {
  const tool = TOOL_BY_CAPABILITY.get(rule.capability);
  if (!tool) return [];
  const patterns = rule.match ?? [];
  if (patterns.length === 0) return [tool];
  if (!PATTERN_CAPABILITIES.has(rule.capability)) return [];
  return patterns.map(
    (pattern) =>
      `${tool}(${rule.capability === 'shell' ? canonicalShellPayload(pattern) : pattern})`,
  );
}
