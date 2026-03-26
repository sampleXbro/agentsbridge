/**
 * Derive install scope from real native importer results for a target subtree/file.
 */

import { basename, join, relative } from 'node:path';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { ExtendPick } from '../config/schema.js';
import type { ImportResult } from '../core/types.js';
import { importNativeToCanonical } from '../canonical/native-extends-importer.js';

export interface StagedImportedNativeRepo {
  stageRoot: string;
  results: ImportResult[];
  cleanup: () => Promise<void>;
}

export interface NativeInstallScope {
  stageRoot: string;
  pick?: ExtendPick;
  features: string[];
  cleanup: () => Promise<void>;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

function overlapsPath(requested: string, imported: string): boolean {
  const a = normalizePath(requested);
  const b = normalizePath(imported);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function addUnique(target: string[] | undefined, value: string): string[] {
  const next = target ?? [];
  if (!next.includes(value)) next.push(value);
  return next;
}

async function makeStageRoot(repoRoot: string): Promise<{
  stageRoot: string;
  cleanup: () => Promise<void>;
}> {
  const stageBase = await mkdtemp(join(tmpdir(), 'am-install-native-'));
  const stageRoot = join(stageBase, 'repo');
  const cleanup = async (): Promise<void> => {
    await rm(stageBase, { recursive: true, force: true });
  };

  try {
    await cp(repoRoot, stageRoot, { recursive: true });
    return { stageRoot, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

function buildPickFromResults(results: ImportResult[], stageRoot: string): ExtendPick | undefined {
  let pick: ExtendPick | undefined;

  for (const result of results) {
    if (result.feature === 'rules' && result.toPath.startsWith('.agentsmesh/rules/')) {
      pick = {
        ...pick,
        rules: addUnique(pick?.rules, basename(result.toPath, '.md')),
      };
      continue;
    }
    if (result.feature === 'commands' && result.toPath.startsWith('.agentsmesh/commands/')) {
      pick = {
        ...pick,
        commands: addUnique(pick?.commands, basename(result.toPath, '.md')),
      };
      continue;
    }
    if (result.feature === 'agents' && result.toPath.startsWith('.agentsmesh/agents/')) {
      pick = {
        ...pick,
        agents: addUnique(pick?.agents, basename(result.toPath, '.md')),
      };
      continue;
    }
    if (result.feature === 'skills' && result.toPath.startsWith('.agentsmesh/skills/')) {
      const rel = normalizePath(
        relative(join(stageRoot, '.agentsmesh', 'skills'), join(stageRoot, result.toPath)),
      );
      const skillName = rel.split('/')[0];
      if (skillName) {
        pick = {
          ...pick,
          skills: addUnique(pick?.skills, skillName),
        };
      }
    }
  }

  if (!pick) return undefined;
  const hasAny =
    (pick.rules?.length ?? 0) +
      (pick.commands?.length ?? 0) +
      (pick.agents?.length ?? 0) +
      (pick.skills?.length ?? 0) >
    0;
  return hasAny ? pick : undefined;
}

function scopeImportedResults(
  pathInRepoPosix: string,
  stageRoot: string,
  results: ImportResult[],
  target: string,
): Omit<NativeInstallScope, 'cleanup' | 'stageRoot'> {
  const requestedPath = join(stageRoot, ...normalizePath(pathInRepoPosix).split('/'));
  const filtered = results.filter((result) => overlapsPath(requestedPath, result.fromPath));
  if (filtered.length === 0) {
    throw new Error(
      `No installable native resources found under "${pathInRepoPosix}" for target "${target}".`,
    );
  }

  return {
    features: [...new Set(filtered.map((result) => result.feature))],
    pick: buildPickFromResults(filtered, stageRoot),
  };
}

export async function stageImportedNativeRepo(
  repoRoot: string,
  target: string,
): Promise<StagedImportedNativeRepo> {
  const { stageRoot, cleanup } = await makeStageRoot(repoRoot);
  try {
    const results = await importNativeToCanonical(stageRoot, target);
    return { stageRoot, results, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export async function stageNativeInstallScope(
  repoRoot: string,
  pathInRepoPosix: string,
  target: string,
): Promise<NativeInstallScope> {
  const staged = await stageImportedNativeRepo(repoRoot, target);
  try {
    return {
      stageRoot: staged.stageRoot,
      cleanup: staged.cleanup,
      ...scopeImportedResults(pathInRepoPosix, staged.stageRoot, staged.results, target),
    };
  } catch (error) {
    await staged.cleanup();
    throw error;
  }
}
