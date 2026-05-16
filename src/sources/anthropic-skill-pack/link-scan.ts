/**
 * Per-entity broken-link discovery for the Anthropic skill-pack aggregator.
 *
 * Builds the set of in-tree paths (canonical entity files plus skill
 * supporting files), walks every entity body via `scanRelativeLinks`,
 * resolves each candidate against the included set, and surfaces entities
 * with at least one non-`in-tree-included` link.
 *
 * Pure: never prompts, never writes; only reads the filesystem to confirm
 * link target existence (via `resolveLink`).
 */

import { basename } from 'node:path';
import { resolveLink, type ResolvedLink } from '../../install/links/resolve-link.js';
import { scanRelativeLinks } from '../../install/links/scan-relative-links.js';
import type { EntityWithBrokenLinks } from '../../install/prompts/broken-link-prompt.js';
import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalRule,
  CanonicalSkill,
} from '../../core/types.js';

type EntityKind = EntityWithBrokenLinks['entityKind'];

interface ScannableEntity {
  readonly kind: EntityKind;
  readonly name: string;
  readonly body: string;
  readonly sourcePath: string;
}

export function toForwardSlashRelative(contentRoot: string, abs: string): string {
  const rootNorm = contentRoot.replaceAll('\\', '/');
  const absNorm = abs.replaceAll('\\', '/');
  const prefix = rootNorm.endsWith('/') ? rootNorm : `${rootNorm}/`;
  return absNorm.startsWith(prefix) ? absNorm.slice(prefix.length) : absNorm;
}

export function buildIncludedPaths(
  contentRoot: string,
  skills: readonly CanonicalSkill[],
  agents: readonly CanonicalAgent[],
  commands: readonly CanonicalCommand[],
  rules: readonly CanonicalRule[],
): ReadonlySet<string> {
  const set = new Set<string>();
  for (const skill of skills) {
    set.add(toForwardSlashRelative(contentRoot, skill.source));
    for (const sf of skill.supportingFiles) {
      set.add(toForwardSlashRelative(contentRoot, sf.absolutePath));
    }
  }
  for (const agent of agents) {
    set.add(toForwardSlashRelative(contentRoot, agent.source));
  }
  for (const cmd of commands) {
    set.add(toForwardSlashRelative(contentRoot, cmd.source));
  }
  for (const rule of rules) {
    set.add(toForwardSlashRelative(contentRoot, rule.source));
  }
  return set;
}

function listScannables(
  skills: readonly CanonicalSkill[],
  agents: readonly CanonicalAgent[],
  commands: readonly CanonicalCommand[],
  rules: readonly CanonicalRule[],
): ScannableEntity[] {
  const out: ScannableEntity[] = [];
  for (const s of skills) {
    out.push({ kind: 'skill', name: s.name, body: s.body, sourcePath: s.source });
  }
  for (const a of agents) {
    out.push({ kind: 'agent', name: a.name, body: a.body, sourcePath: a.source });
  }
  for (const c of commands) {
    out.push({ kind: 'command', name: c.name, body: c.body, sourcePath: c.source });
  }
  for (const r of rules) {
    out.push({ kind: 'rule', name: basename(r.source, '.md'), body: r.body, sourcePath: r.source });
  }
  return out;
}

export async function detectBrokenLinks(
  contentRoot: string,
  skills: readonly CanonicalSkill[],
  agents: readonly CanonicalAgent[],
  commands: readonly CanonicalCommand[],
  rules: readonly CanonicalRule[],
  includedPaths: ReadonlySet<string>,
): Promise<readonly EntityWithBrokenLinks[]> {
  const entities = listScannables(skills, agents, commands, rules);
  const out: EntityWithBrokenLinks[] = [];
  for (const entity of entities) {
    const links = scanRelativeLinks(entity.body);
    if (links.length === 0) continue;
    const fromFile = toForwardSlashRelative(contentRoot, entity.sourcePath);
    const broken: ResolvedLink[] = [];
    for (const link of links) {
      const resolved = await resolveLink({ link, fromFile, contentRoot, includedPaths });
      if (resolved.classification !== 'in-tree-included') broken.push(resolved);
    }
    if (broken.length > 0) {
      out.push({ entityKind: entity.kind, entityName: entity.name, resolved: broken });
    }
  }
  return out;
}
