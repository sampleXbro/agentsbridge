/**
 * R-4 extension: build a Set of `<feature>/<name>` keys for canonical items
 * whose `source` lives under `.agentsmesh/packs/` (i.e. materialized from an
 * install pack). The link validator uses this to demote broken-link findings
 * in pack-originated outputs to warnings — the consumer has no way to fix
 * sibling-reference issues authored by the upstream pack maintainer.
 */

import { sep } from 'node:path';
import type { CanonicalFiles } from '../types.js';

const PACK_MARKERS: readonly string[] = [
  `${sep}.agentsmesh${sep}packs${sep}`,
  '/.agentsmesh/packs/',
];

function isUnderPacks(sourcePath: string): boolean {
  return PACK_MARKERS.some((marker) => sourcePath.includes(marker));
}

export function buildPackOriginatedKeys(canonical: CanonicalFiles): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const rule of canonical.rules) {
    if (isUnderPacks(rule.source)) {
      const name = rule.root ? '_root' : ruleNameFromSource(rule.source);
      if (name) keys.add(`rules/${name}`);
    }
  }
  for (const agent of canonical.agents) {
    if (isUnderPacks(agent.source)) keys.add(`agents/${agent.name}`);
  }
  for (const cmd of canonical.commands) {
    if (isUnderPacks(cmd.source)) keys.add(`commands/${cmd.name}`);
  }
  for (const skill of canonical.skills) {
    if (isUnderPacks(skill.source)) keys.add(`skills/${skill.name}`);
  }
  return keys;
}

function ruleNameFromSource(source: string): string {
  const slash = source.replace(/\\/g, '/');
  const base = slash.split('/').pop() ?? '';
  return base.endsWith('.md') ? base.slice(0, -3) : base;
}
