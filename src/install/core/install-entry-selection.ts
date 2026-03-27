/**
 * Derive install entry selection metadata from narrowed resource pools.
 */

import type { ExtendPick } from '../../config/core/schema.js';

export interface InstallSelectedNames {
  skillNames: string[];
  ruleSlugs: string[];
  commandNames: string[];
  agentNames: string[];
}

export function pickForSelectedResources(
  pick: ExtendPick | undefined,
  selected: InstallSelectedNames,
): ExtendPick | undefined {
  if (!pick) return undefined;
  const filtered: ExtendPick = {};
  const skills = pick.skills?.filter((name) => selected.skillNames.includes(name));
  const rules = pick.rules?.filter((name) => selected.ruleSlugs.includes(name));
  const commands = pick.commands?.filter((name) => selected.commandNames.includes(name));
  const agents = pick.agents?.filter((name) => selected.agentNames.includes(name));
  if (skills && skills.length > 0) filtered.skills = skills;
  if (rules && rules.length > 0) filtered.rules = rules;
  if (commands && commands.length > 0) filtered.commands = commands;
  if (agents && agents.length > 0) filtered.agents = agents;
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function pathEndsWithName(pathInRepo: string, name: string): boolean {
  const segments = pathInRepo.split('/').filter(Boolean);
  return segments.length > 0 && segments[segments.length - 1] === name;
}

function inferSingleNamePick(
  pathInRepo: string,
  names: string[],
  totalBeforeConflict: number,
): boolean {
  if (totalBeforeConflict !== 1 || names.length !== 1) return false;
  return pathEndsWithName(pathInRepo, names[0]!);
}

export function buildInstallPick(args: {
  pathInRepo: string;
  implicitPick?: ExtendPick;
  preConflictCounts: { skills: number; rules: number; commands: number; agents: number };
  selected: InstallSelectedNames;
}): ExtendPick | undefined {
  const { pathInRepo, implicitPick, preConflictCounts, selected } = args;
  const out: ExtendPick = {};

  const addSkills =
    selected.skillNames.length > 0 &&
    (Boolean(implicitPick?.skills?.length) ||
      selected.skillNames.length < preConflictCounts.skills ||
      inferSingleNamePick(pathInRepo, selected.skillNames, preConflictCounts.skills));
  const addRules =
    selected.ruleSlugs.length > 0 &&
    (Boolean(implicitPick?.rules?.length) ||
      selected.ruleSlugs.length < preConflictCounts.rules ||
      inferSingleNamePick(pathInRepo, selected.ruleSlugs, preConflictCounts.rules));
  const addCommands =
    selected.commandNames.length > 0 &&
    (Boolean(implicitPick?.commands?.length) ||
      selected.commandNames.length < preConflictCounts.commands ||
      inferSingleNamePick(pathInRepo, selected.commandNames, preConflictCounts.commands));
  const addAgents =
    selected.agentNames.length > 0 &&
    (Boolean(implicitPick?.agents?.length) ||
      selected.agentNames.length < preConflictCounts.agents ||
      inferSingleNamePick(pathInRepo, selected.agentNames, preConflictCounts.agents));

  if (addSkills) out.skills = [...selected.skillNames];
  if (addRules) out.rules = [...selected.ruleSlugs];
  if (addCommands) out.commands = [...selected.commandNames];
  if (addAgents) out.agents = [...selected.agentNames];
  return Object.keys(out).length ? out : undefined;
}

export function deriveInstallFeatures(
  discoveredFeatures: string[],
  selected: InstallSelectedNames,
): string[] {
  const set = new Set(discoveredFeatures);
  if (selected.skillNames.length === 0) set.delete('skills');
  if (selected.ruleSlugs.length === 0) set.delete('rules');
  if (selected.commandNames.length === 0) set.delete('commands');
  if (selected.agentNames.length === 0) set.delete('agents');
  return [...set];
}

function isEmptyInstallSelection(selected: InstallSelectedNames): boolean {
  return (
    selected.skillNames.length === 0 &&
    selected.ruleSlugs.length === 0 &&
    selected.commandNames.length === 0 &&
    selected.agentNames.length === 0
  );
}

export function ensureInstallSelection(args: {
  selected: InstallSelectedNames;
  discoveredFeatures: string[];
  preConflict: { skills: number; rules: number; commands: number; agents: number };
}): void {
  const { selected, discoveredFeatures, preConflict } = args;
  const had = (feature: string): boolean => discoveredFeatures.includes(feature);
  const dropped =
    (had('skills') && selected.skillNames.length === 0 && preConflict.skills > 0 && 'skills') ||
    (had('rules') && selected.ruleSlugs.length === 0 && preConflict.rules > 0 && 'rules') ||
    (had('commands') &&
      selected.commandNames.length === 0 &&
      preConflict.commands > 0 &&
      'commands') ||
    (had('agents') && selected.agentNames.length === 0 && preConflict.agents > 0 && 'agents');
  if (dropped) {
    throw new Error(`No ${dropped} selected to install.`);
  }

  const hasSingletonFeatures = discoveredFeatures.some((feature) =>
    ['mcp', 'permissions', 'hooks', 'ignore'].includes(feature),
  );
  if (isEmptyInstallSelection(selected) && !hasSingletonFeatures) {
    throw new Error('No resources selected to install.');
  }
}
