import { basename, dirname, join, relative } from 'node:path';
import { cp, mkdtemp, stat, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { mkdirp, readDirRecursive, readFileSafe } from '../../utils/filesystem/fs.js';
import { isSkillPackLayout } from '../../canonical/load/skill-pack-load.js';
import { readSkillFrontmatterName, cpFilteredSkill } from '../source/skill-repo-filter.js';
import { isBoilerplate } from '../importers/boilerplate-filter.js';
import { normalizeMdcToCanonical } from './mdc-reader.js';
import { sanitizeNameSegment, computeDestName, namespacedName } from './collection-naming.js';
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

function isAcceptedFile(file: string, acceptMdc: boolean): boolean {
  const lower = file.toLowerCase();
  if (lower.endsWith('.md')) return true;
  if (acceptMdc && lower.endsWith('.mdc')) return true;
  return false;
}

async function stageSingleFile(
  sourcePath: string,
  destinationDir: string,
  acceptMdc: boolean,
): Promise<void> {
  if (!isAcceptedFile(sourcePath, acceptMdc)) {
    throw new Error(`Manual install only supports .md files for this collection: ${sourcePath}`);
  }
  await mkdirp(destinationDir);
  if (sourcePath.toLowerCase().endsWith('.mdc')) {
    const content = await readFileSafe(sourcePath);
    if (!content) return;
    const destName = basename(sourcePath).replace(/\.mdc$/i, '.md');
    await writeFile(join(destinationDir, destName), normalizeMdcToCanonical(content));
  } else {
    await cp(sourcePath, join(destinationDir, basename(sourcePath)));
  }
}

async function stageMarkdownCollection(
  sourceRoot: string,
  destinationDir: string,
  acceptMdc: boolean,
): Promise<void> {
  const info = await stat(sourceRoot);
  if (info.isFile()) return stageSingleFile(sourceRoot, destinationDir, acceptMdc);

  const files = (await readDirRecursive(sourceRoot)).filter(
    (file) => isAcceptedFile(file, acceptMdc) && !isBoilerplate(basename(file)),
  );
  if (files.length === 0) {
    throw new Error(
      `No installable files found under ${sourceRoot} for manual install. ` +
        `Try a different --path to point at the directory holding *.md (or *.mdc) files, ` +
        `or omit --as so agentsmesh can auto-detect the layout.`,
    );
  }

  const bareCounts = new Map<string, number>();
  for (const file of files) {
    const name = computeDestName(file);
    bareCounts.set(name, (bareCounts.get(name) ?? 0) + 1);
  }

  const usedNames = new Map<string, string>();
  await mkdirp(destinationDir);
  for (const file of files) {
    const bare = computeDestName(file);
    const hasCollision = (bareCounts.get(bare) ?? 0) > 1;
    let destName = hasCollision ? namespacedName(sourceRoot, file, bare) : bare;
    if (usedNames.has(destName) && usedNames.get(destName) !== file) {
      const rel = relative(sourceRoot, file)
        .replace(/\\/g, '/')
        .split('/')
        .map(sanitizeNameSegment)
        .filter(Boolean);
      const ext = bare.includes('.') ? '.' + bare.split('.').pop()! : '';
      const stem = rel.join('-').replace(/\.(md|mdc)$/i, '');
      destName = stem + ext || destName;
    }
    if (usedNames.has(destName)) {
      throw new Error(
        `Manual install could not resolve duplicate name "${destName}" under ${sourceRoot} (${usedNames.get(destName)} and ${file}).`,
      );
    }
    usedNames.set(destName, file);
    const isMdc = file.toLowerCase().endsWith('.mdc');
    if (isMdc) {
      const content = await readFileSafe(file);
      if (!content) continue;
      await writeFile(join(destinationDir, destName), normalizeMdcToCanonical(content));
    } else {
      await cp(file, join(destinationDir, destName));
    }
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
      await stageMarkdownCollection(sourceRoot, destDir, as === 'rules');
    }
    return staged;
  } catch (error) {
    await staged.cleanup();
    throw error;
  }
}
