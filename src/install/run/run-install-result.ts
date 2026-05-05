/**
 * Build structured result data from install execution.
 */

import { ruleSlug } from '../core/validate-resources.js';
import type { InstallExecuteResult } from './run-install-execute.js';

interface SelectedNames {
  skillNames: string[];
  ruleSlugs: string[];
  commandNames: string[];
  agentNames: string[];
}

export function buildInstalledList(
  selected: SelectedNames,
  entryName: string,
): InstallExecuteResult['installed'] {
  const installed: InstallExecuteResult['installed'] = [];
  for (const name of selected.skillNames) {
    installed.push({ kind: 'skill', name, path: entryName });
  }
  for (const name of selected.ruleSlugs) {
    installed.push({ kind: 'rule', name, path: entryName });
  }
  for (const name of selected.commandNames) {
    installed.push({ kind: 'command', name, path: entryName });
  }
  for (const name of selected.agentNames) {
    installed.push({ kind: 'agent', name, path: entryName });
  }
  return installed;
}

export function buildSkippedList(
  skillsPool: Array<{ name: string }>,
  rulesPool: Array<{ source: string }>,
  commandsPool: Array<{ name: string }>,
  agentsPool: Array<{ name: string }>,
  selected: SelectedNames,
): InstallExecuteResult['skipped'] {
  const skipped: InstallExecuteResult['skipped'] = [];
  for (const s of skillsPool) {
    if (!selected.skillNames.includes(s.name)) {
      skipped.push({ kind: 'skill', name: s.name, reason: 'conflict' });
    }
  }
  for (const r of rulesPool) {
    const slug = ruleSlug(r as Parameters<typeof ruleSlug>[0]);
    if (!selected.ruleSlugs.includes(slug)) {
      skipped.push({ kind: 'rule', name: slug, reason: 'conflict' });
    }
  }
  for (const c of commandsPool) {
    if (!selected.commandNames.includes(c.name)) {
      skipped.push({ kind: 'command', name: c.name, reason: 'conflict' });
    }
  }
  for (const a of agentsPool) {
    if (!selected.agentNames.includes(a.name)) {
      skipped.push({ kind: 'agent', name: a.name, reason: 'conflict' });
    }
  }
  return skipped;
}
