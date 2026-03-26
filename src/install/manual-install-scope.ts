/**
 * Stage manually typed install folders as canonical content under a temp .agentsmesh tree.
 */

import { basename, dirname, join, relative } from 'node:path';
import { cp, mkdtemp, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { mkdirp, readDirRecursive } from '../utils/fs.js';
import { isSkillPackLayout } from '../canonical/skill-pack-load.js';
import { readSkillFrontmatterName, cpFilteredSkill } from './skill-repo-filter.js';
import type { ManualInstallAs } from './manual-install-mode.js';

export interface ManualInstallScope {
  discoveryRoot: string;
  cleanup: () => Promise<void>;
}

interface ManualInstallScopeOptions {
  preferredSkillNames?: string[];
}

async function createStageRoot(): Promise<ManualInstallScope> {
  const stageBase = await mkdtemp(join(tmpdir(), 'am-install-manual-'));
  const discoveryRoot = join(stageBase, 'repo');
  await mkdirp(join(discoveryRoot, '.agentsmesh'));
  return {
    discoveryRoot,
    cleanup: async (): Promise<void> => {
      await rm(stageBase, { recursive: true, force: true });
    },
  };
}

async function stageMarkdownCollection(sourceRoot: string, destinationDir: string): Promise<void> {
  const info = await stat(sourceRoot);
  if (info.isFile()) {
    if (!sourceRoot.toLowerCase().endsWith('.md')) {
      throw new Error(`Manual install only supports .md files for this collection: ${sourceRoot}`);
    }
    await mkdirp(destinationDir);
    await cp(sourceRoot, join(destinationDir, basename(sourceRoot)));
    return;
  }

  const files = (await readDirRecursive(sourceRoot)).filter((file) =>
    file.toLowerCase().endsWith('.md'),
  );
  if (files.length === 0) {
    throw new Error(`No .md files found under ${sourceRoot} for manual install.`);
  }

  const usedNames = new Map<string, string>();
  await mkdirp(destinationDir);
  for (const file of files) {
    const name = basename(file);
    const previous = usedNames.get(name);
    if (previous) {
      throw new Error(
        `Manual install found duplicate file name "${name}" under ${sourceRoot} (${previous} and ${file}).`,
      );
    }
    usedNames.set(name, file);
    await cp(file, join(destinationDir, name));
  }
}

async function stagePreferredSkills(
  sourceRoot: string,
  destinationDir: string,
  preferredSkillNames: string[],
): Promise<boolean> {
  if (preferredSkillNames.length === 0) {
    return false;
  }

  const wanted = new Set(preferredSkillNames);
  const matches = new Map<string, string>();
  for (const file of await readDirRecursive(sourceRoot)) {
    if (!file.endsWith('/SKILL.md') && !file.endsWith('\\SKILL.md')) continue;
    const skillDir = dirname(file);
    const skillName = basename(skillDir);
    if (!wanted.has(skillName)) continue;
    const previous = matches.get(skillName);
    if (previous && previous !== skillDir) {
      throw new Error(
        `Manual skill replay found duplicate skill "${skillName}" under ${sourceRoot} (${previous} and ${skillDir}).`,
      );
    }
    matches.set(skillName, skillDir);
  }

  if (matches.size !== preferredSkillNames.length) return false;

  await mkdirp(destinationDir);
  for (const skillName of preferredSkillNames) {
    await cp(matches.get(skillName)!, join(destinationDir, skillName), { recursive: true });
  }
  return true;
}

async function stageSkills(
  sourceRoot: string,
  destinationDir: string,
  options: ManualInstallScopeOptions = {},
): Promise<void> {
  const info = await stat(sourceRoot);
  if (info.isFile()) {
    if (basename(sourceRoot) !== 'SKILL.md') {
      throw new Error(`Manual skill install expects SKILL.md or a skill directory: ${sourceRoot}`);
    }
    const skillName = basename(dirname(sourceRoot));
    const skillDir = join(destinationDir, skillName);
    await mkdirp(skillDir);
    await cp(dirname(sourceRoot), skillDir, { recursive: true });
    return;
  }

  if (await isSkillPackLayout(sourceRoot)) {
    if ((await stat(join(sourceRoot, 'SKILL.md')).catch(() => null))?.isFile()) {
      if (
        await stagePreferredSkills(sourceRoot, destinationDir, options.preferredSkillNames ?? [])
      ) {
        return;
      }
      const fmName = await readSkillFrontmatterName(join(sourceRoot, 'SKILL.md'));
      const skillName = fmName || basename(sourceRoot);
      const skillDir = join(destinationDir, skillName);
      await mkdirp(destinationDir);
      await cpFilteredSkill(sourceRoot, skillDir);
      return;
    }
    if (await stagePreferredSkills(sourceRoot, destinationDir, options.preferredSkillNames ?? [])) {
      return;
    }
    await mkdirp(destinationDir);
    const entries = await readDirRecursive(sourceRoot);
    const roots = new Set<string>();
    for (const file of entries.filter(
      (entry) => entry.endsWith('/SKILL.md') || entry.endsWith('\\SKILL.md'),
    )) {
      roots.add(relative(sourceRoot, dirname(file)).split(/[\\/]/)[0]!);
    }
    for (const root of roots) {
      await cp(join(sourceRoot, root), join(destinationDir, root), { recursive: true });
    }
    return;
  }

  throw new Error(
    `Manual skill install expects a skill directory or skills collection at ${sourceRoot}.`,
  );
}

export async function stageManualInstallScope(
  sourceRoot: string,
  as: ManualInstallAs,
  options: ManualInstallScopeOptions = {},
): Promise<ManualInstallScope> {
  const staged = await createStageRoot();
  try {
    const destDir = join(staged.discoveryRoot, '.agentsmesh', as);
    if (as === 'skills') {
      await stageSkills(sourceRoot, destDir, options);
    } else {
      await stageMarkdownCollection(sourceRoot, destDir);
    }
    return staged;
  } catch (error) {
    await staged.cleanup();
    throw error;
  }
}
